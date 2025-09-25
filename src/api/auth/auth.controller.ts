import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth, ApiPublic } from '@/decorators/http.decorators';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginReqDto } from './dto/login.req.dto';
import { LoginResDto } from './dto/login.res.dto';
import { RefreshReqDto } from './dto/refresh.req.dto';
import { RefreshResDto } from './dto/refresh.res.dto';
import { RegisterResDto } from './dto/register.res.dto';
import { RequestOtpReqDto } from './dto/request-otp.req.dto';
import { JwtPayloadType } from './types/jwt-payload.type';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Unified OTP endpoints
  @ApiPublic({
    summary: 'Request OTP (login or register)',
    type: RegisterResDto,
  })
  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpReqDto): Promise<RegisterResDto> {
    const res = await this.authService.requestOtp(dto.countryCode, dto.phone);
    return { userId: res.userId };
  }

  @ApiPublic({ summary: 'Verify OTP and sign in', type: LoginResDto })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: LoginReqDto): Promise<LoginResDto> {
    return await this.authService.verifyOtp(dto);
  }

  @ApiAuth({
    summary: 'Logout',
    errorResponses: [400, 401, 403, 500],
  })
  @Post('logout')
  async logout(@CurrentUser() userToken: JwtPayloadType): Promise<void> {
    await this.authService.logout(userToken);
  }

  @ApiPublic({
    type: RefreshResDto,
    summary: 'Refresh token',
  })
  @Post('refresh')
  async refresh(@Body() dto: RefreshReqDto): Promise<RefreshResDto> {
    return await this.authService.refreshToken(dto);
  }
}
