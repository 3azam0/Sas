import type {View} from './store';

export const navigationGroups:{title:string;views:View[];collapsible?:boolean}[]=[
 {title:'التشغيل اليومي',views:['overview','pos','kitchenDisplay','inventory']},
 {title:'عمليات المخزون',views:['purchasing','returns','transfers','counts','activity'],collapsible:true},
 {title:'المطابخ والتحضير',views:['kitchenIssues','preparation','recipes','production','butchery'],collapsible:true},
 {title:'المبيعات والتقارير',views:['sales','finance','reports'],collapsible:true},
 {title:'الإعدادات',views:['setup','suppliers','opening'],collapsible:true},
 {title:'المساعدة والمتابعة',views:['sync','guide']}
];
