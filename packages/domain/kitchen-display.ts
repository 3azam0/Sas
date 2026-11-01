import {BusinessError,type KitchenState} from '@saas/contracts';
export const kitchenStateLabels:Record<KitchenState,string>={new:'جديد',preparing:'قيد التجهيز',ready:'جاهز',collected:'تم الاستلام'};
export const nextKitchenState:Partial<Record<KitchenState,KitchenState>>={new:'preparing',preparing:'ready',ready:'collected'};
export function validateKitchenTransition(current:KitchenState,next:KitchenState){if(nextKitchenState[current]!==next)throw new BusinessError('INVALID_KITCHEN_STATE','انتقل إلى المرحلة التالية بالترتيب.');}
