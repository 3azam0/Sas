import type {View} from './store';

export const navigationGroups:{title:string;views:View[]}[]=[
 {title:'التشغيل اليومي',views:['overview','inventory','kitchenIssues','sales']},
 {title:'إدارة المخزون',views:['purchasing','suppliers','returns','transfers','counts','opening','activity']},
 {title:'التكاليف والتحضير',views:['reports','recipes','production']},
 {title:'الإعدادات والمتابعة',views:['setup','sync']}
];
