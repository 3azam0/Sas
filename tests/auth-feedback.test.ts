import {it,expect} from 'vitest';
import {loginFailure,validateLogin} from '../apps/web/src/auth-feedback';
it('requires both credentials without requiring a new-password policy for existing users',()=>{
 expect(validateLogin('','')).toHaveProperty('email');expect(validateLogin('','')).toHaveProperty('password');
 expect(validateLogin(' owner+branch@example.com ','x')).toEqual({});
 expect(validateLogin('bad address@example.com','x').email).toBeTruthy();
 expect(validateLogin('owner@example.com','x'.repeat(101)).password).toBeTruthy();
});
it('keeps credential rejection, access, throttling and service outages distinct without echoing server messages',()=>{
 expect(loginFailure(401)).toContain('تحقق من البريد');expect(loginFailure(403)).toContain('صلاحية الوصول');
 expect(loginFailure(429)).toContain('انتظر');expect(loginFailure(503)).toContain('غير متاحة');
 expect(loginFailure(503)).not.toContain('كلمة المرور');expect(loginFailure(400)).toContain('تحقق');
});
