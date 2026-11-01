import {quantitySchema} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';

/** Display-only projection; document validation and server acceptance remain authoritative. */
export function issueStockPreview(available:string,enteredQuantity:string){
 if(!enteredQuantity.trim())return {status:'empty' as const,remaining:null,shortage:null};
 const parsed=quantitySchema.safeParse(normalizeNumber(enteredQuantity));
 if(!parsed.success)return {status:'invalid' as const,remaining:null,shortage:null};
 const remaining=decimal(available).sub(parsed.data);
 return remaining.lt(0)?{status:'shortage' as const,remaining:null,shortage:remaining.abs().toString()}:{status:'ready' as const,remaining:remaining.toString(),shortage:null};
}
