import type {View} from './store';

export const navigationGroups:{title:string;views:View[];collapsible?:boolean}[]=[
 {title:'التشغيل اليومي',views:['overview','pos','kitchenDisplay']},
 {title:'المخزون',views:['inventory','setup','suppliers','opening','purchasing','returns','transfers','counts','inventoryOperations','activity'],collapsible:true},
 {title:'المطابخ والتحضير',views:['kitchenIssues','preparation','recipes','production','butchery'],collapsible:true},
 {title:'المبيعات والتقارير',views:['sales','finance','reports'],collapsible:true},
 {title:'الموظفون',views:['employees','attendance'],collapsible:true},
 {title:'المساعدة والمتابعة',views:['sync','guide']}
];
