export type LoginFieldErrors={email?:string;password?:string};
export function validateLogin(email:string,password:string):LoginFieldErrors{
 const errors:LoginFieldErrors={};
 if(!email.trim())errors.email='أدخل البريد الإلكتروني.';
 else if(email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))errors.email='أدخل بريدًا إلكترونيًا صالحًا، مثل name@example.com.';
 if(!password)errors.password='أدخل كلمة المرور.';
 else if(password.length>100)errors.password='كلمة المرور تتجاوز الحد المسموح. تواصل مع مدير المؤسسة.';
 return errors;
}
export function loginFailure(status:number){
 if(status===429)return 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.';
 if(status===401)return 'تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور ثم حاول مجددًا.';
 if(status===403)return 'تعذر فتح مساحة العمل بهذا الحساب. تواصل مع مدير المؤسسة للتحقق من صلاحية الوصول.';
 if(status===400||status===413)return 'تحقق من البريد وكلمة المرور ثم حاول مجددًا.';
 return 'خدمة تسجيل الدخول غير متاحة الآن. حاول مجددًا بعد قليل.';
}
