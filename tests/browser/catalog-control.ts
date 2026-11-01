import {expect,type Locator,type Page} from '@playwright/test';
/** Select through the visible control; stored IDs are never typed into its label. */
export async function selectCatalog(page:Page,field:Locator,value:string|{label:string}){
 if(await field.evaluate(node=>node.tagName==='SELECT')){await field.selectOption(value);return;}
 const label=typeof value==='string'?await field.evaluate((node,value)=>Array.from(node.closest('.catalog-select')!.querySelectorAll('option')).find(option=>option.value===value)?.textContent?.trim(),value):value.label;
 if(!label)throw new Error(`Catalog option unavailable: ${value}`);
 await field.fill(label);const option=page.getByRole('listbox').getByRole('option',{name:label,exact:true});await expect(option).not.toHaveAttribute('aria-disabled','true');await option.click();
}
