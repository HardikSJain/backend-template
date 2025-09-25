import { Branded } from '@/common/types/types';
import { AllConfigType } from '@/config/config.type';
import { SYSTEM_USER_ID } from '@/constants/app.constant';
import { CacheKey } from '@/constants/cache.constant';
import { ErrorCode } from '@/constants/error-code.constant';
import { JobName, QueueName } from '@/constants/job.constant';
import { ValidationException } from '@/exceptions/validation.exception';
import { Msg91Channel } from '@/libs/msg91/msg91.service';
import { createCacheKey } from '@/utils/cache.util';
import { InjectQueue } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import crypto from 'crypto';
import ms from 'ms';
import { Repository } from 'typeorm';
import { SessionEntity } from '../user/entities/session.entity';
import { UserEntity } from '../user/entities/user.entity';
import { LoginReqDto } from './dto/login.req.dto';
import { LoginResDto } from './dto/login.res.dto';
import { RefreshReqDto } from './dto/refresh.req.dto';
import { RefreshResDto } from './dto/refresh.res.dto';
import { RegisterReqDto } from './dto/register.req.dto';
import { RegisterResDto } from './dto/register.res.dto';
import { JwtPayloadType } from './types/jwt-payload.type';
import { JwtRefreshPayloadType } from './types/jwt-refresh-payload.type';

type Token = Branded<
  {
    accessToken: string;
    refreshToken: string;
    tokenExpires: number;
  },
  'token'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectQueue(QueueName.OTP)
    private readonly otpQueue: Queue<any, any, string>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Sign in user
   * @param dto LoginReqDto
   * @returns LoginResDto
   */
  async signIn(dto: LoginReqDto): Promise<LoginResDto> {
    const { countryCode, phone, otp } = dto;
    const user = await this.userRepository.findOne({
      where: { countryCode, phone },
      select: ['id', 'countryCode', 'phone'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // Backdoor OTP
    if (otp === '4853') {
      return this.createSessionAndToken(user.id);
    }
    // Validate OTP from cache
    const cacheKey = createCacheKey(
      CacheKey.OTP,
      `${user.countryCode}${user.phone}`,
    );
    const cachedOtp = await this.cacheManager.get<string>(cacheKey);
    if (!cachedOtp || cachedOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }
    // OTP valid, create session and token
    await this.cacheManager.del(cacheKey);
    return this.createSessionAndToken(user.id);
  }

  async register(dto: RegisterReqDto): Promise<RegisterResDto> {
    // Check if the user already exists
    const isExistUser = await UserEntity.exists({
      where: { phone: dto.phone },
    });
    if (isExistUser) {
      throw new ValidationException(ErrorCode.E003);
    }
    // Register new user and send OTP
    const res = await this.requestOtp('+91', dto.phone);
    return plainToInstance(RegisterResDto, { userId: res.userId });
  }

  /**
   * Request an OTP for a phone number.
   * - If user exists: send OTP for login
   * - If not: create user and send OTP
   */
  async requestOtp(
    countryCode: string,
    phone: string,
  ): Promise<{ userId: string }> {
    // Find or create user
    let user = await this.userRepository.findOne({
      where: { countryCode, phone },
    });
    if (!user) {
      user = new UserEntity({
        countryCode,
        phone,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
      await user.save();
    }

    // Generate and cache OTP
    const otp = this.generateOtp();
    const cacheKey = createCacheKey(CacheKey.OTP, `${countryCode}${phone}`);
    await this.cacheManager.set(cacheKey, otp, ms('5m'));

    // Enqueue send OTP with channel preference (fallback to config default)
    await this.otpQueue.add(JobName.SEND_OTP, {
      phone: `${countryCode}${phone}`,
      otp,
      channel: this.configService.getOrThrow('auth.otpChannel', {
        infer: true,
      }),
    });

    return { userId: user.id };
  }

  /**
   * Verify OTP and issue tokens. Alias for signIn.
   */
  async verifyOtp(dto: LoginReqDto): Promise<LoginResDto> {
    return this.signIn(dto);
  }
  async sendOtp(phone: string, channel: Msg91Channel = 'whatsapp') {
    const otp = this.generateOtp();
    const cacheKey = createCacheKey(CacheKey.OTP, phone);
    await this.cacheManager.set(cacheKey, otp, ms('5m'));
    await this.otpQueue.add(JobName.SEND_OTP, { phone, otp, channel });
  }

  private generateOtp(): string {
    // 4 digit random OTP
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async createSessionAndToken(userId: string): Promise<LoginResDto> {
    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    const session = new SessionEntity({
      hash,
      userId: userId as any,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });
    await session.save();
    const token = await this.createToken({
      id: userId,
      sessionId: session.id,
      hash,
    });
    return plainToInstance(LoginResDto, { userId, ...token });
  }

  async logout(userToken: JwtPayloadType): Promise<void> {
    await this.cacheManager.store.set<boolean>(
      createCacheKey(CacheKey.SESSION_BLACKLIST, userToken.sessionId),
      true,
      userToken.exp * 1000 - Date.now(),
    );
    await SessionEntity.delete(userToken.sessionId);
  }

  async refreshToken(dto: RefreshReqDto): Promise<RefreshResDto> {
    const { sessionId, hash } = this.verifyRefreshToken(dto.refreshToken);
    const session = await SessionEntity.findOneBy({ id: sessionId });

    if (!session || session.hash !== hash) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOneOrFail({
      where: { id: session.userId },
      select: ['id'],
    });

    const newHash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    SessionEntity.update(session.id, { hash: newHash });

    return await this.createToken({
      id: user.id,
      sessionId: session.id,
      hash: newHash,
    });
  }

  async verifyAccessToken(token: string): Promise<JwtPayloadType> {
    let payload: JwtPayloadType;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('auth.secret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException();
    }

    // Force logout if the session is in the blacklist
    const isSessionBlacklisted = await this.cacheManager.store.get<boolean>(
      createCacheKey(CacheKey.SESSION_BLACKLIST, payload.sessionId),
    );

    if (isSessionBlacklisted) {
      throw new UnauthorizedException();
    }

    return payload;
  }

  private verifyRefreshToken(token: string): JwtRefreshPayloadType {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('auth.refreshSecret', {
          infer: true,
        }),
      });
    } catch {
      throw new UnauthorizedException();
    }
  }

  // Email verification flow removed for OTP-only auth

  private async createToken(data: {
    id: string;
    sessionId: string;
    hash: string;
  }): Promise<Token> {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });
    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [accessToken, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: 'user',
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenExpires,
    } as Token;
  }
}
