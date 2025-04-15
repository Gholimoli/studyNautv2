import { RegisterUserDto } from '../types/auth.schemas';
export declare class AuthService {
    register(userData: RegisterUserDto): Promise<{
        id: number;
        username: string;
        email: string;
        displayName: string | null;
        role: string;
    }>;
}
export declare const authService: AuthService;
