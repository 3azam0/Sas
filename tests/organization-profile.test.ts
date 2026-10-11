import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getSnapshot} from '@saas/server';
import {organizationProfileSchema,type Access} from '@saas/contracts';

it('returns the signed-in organization profile without changing stock or exposing another tenant profile',async()=>{
 const db=await createDatabase();try{
  await seed(db);const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
  const before=await getSnapshot(db,access);const profile={nameEn:'Test restaurant',city:'العلمين',phone:'01127010249',logoPath:'/branding/test-logo.webp'};
  await db.query('UPDATE organizations SET profile=$1::jsonb WHERE id=$2',[JSON.stringify(profile),'grills']);
  const after=await getSnapshot(db,access),other=await getSnapshot(db,{...access,organizationId:'bistro'});
  expect(after.organizationProfile).toEqual(profile);expect(other.organizationProfile).toEqual({});
  expect(after.generation).toBe(before.generation);expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);
 }finally{await db.close();}
});

it('rejects executable links, off-origin logos and invalid WhatsApp numbers',()=>{
 for(const profile of [{mapUrl:'javascript:alert(1)'},{facebookUrl:'http://example.com'},{logoPath:'https://example.com/logo.png'},{logoPath:'/branding/../logo.png'},{whatsapp:'javascript:alert(1)'}])expect(organizationProfileSchema.safeParse(profile).success).toBe(false);
 expect(organizationProfileSchema.safeParse({whatsapp:'+201127010249',mapUrl:'https://maps.app.goo.gl/XTYbVoJNi6ycWQs18'}).success).toBe(true);
});
