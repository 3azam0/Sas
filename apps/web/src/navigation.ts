import type {View} from './store';

export const navigationGroups:{title:string;views:View[];collapsible?:boolean}[]=[
 {title:'التشغيل اليومي',views:['overview','inventory','kitchenIssues','sales','activity']},
 {title:'عمليات المخزون',views:['purchasing','returns','transfers','counts'],collapsible:true},
 {title:'التقارير والتحضير',views:['reports','recipes','production'],collapsible:true},
 {title:'الإعدادات',views:['setup','suppliers','opening'],collapsible:true},
 {title:'المساعدة والمتابعة',views:['sync','guide']}
];
