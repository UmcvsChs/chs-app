import os,re,shutil,zipfile,html,datetime
O='/mnt/user-data/outputs'; D='/home/claude/chs_repo_final_check/chs-v2/public/documents'
R='/home/claude/chs_repo_final_check'
V='/home/claude/chs_repo_final_check/CHS_GUIDES_VAULT'
shutil.rmtree(V,ignore_errors=True)
# (folder, filename, audience, description)
G=[
('1_Users_and_Customers','CHS_USERS_GUIDE.docx','All users','Full users guide (buyers, tenants, owners, agents, vendors, artisans)'),
('1_Users_and_Customers','CHS_CLAIMS_USER_GUIDE.pdf','Buyers, sellers','Damaged/faulty goods claims and refunds'),
('1_Users_and_Customers','CHS_Vendor_and_Service_Provider_Guide.pdf','Vendors, artisans','Selling and offering services on the Marketplace'),
('1_Users_and_Customers','CHS_PROPERTY_MANAGER_GUIDE.docx','Property managers','Managing properties on behalf of owners'),
('1_Users_and_Customers','CHS_Standard_Condition_Affidavit_Template.pdf','Owners, tenants','Standard condition affidavit template'),
('1_Users_and_Customers','CHS_House_Rules_Sample.pdf','Hosts, guests','Sample house rules'),
('2_Staff_and_Admin','CHS_TEAM_ACCESS_GUIDE.pdf','Staff, admins','Latest: how staff/admins sign in via the separate team door'),
('2_Staff_and_Admin','CHS_ADMIN_ACCESS_RULES.pdf','Super admin, admins','Invite-only admins, login codes, lock, 120-min idle logout'),
('2_Staff_and_Admin','CHS_STAFF_FEATURE_EXPLAINER.md','Staff','What each staff role can do'),
('2_Staff_and_Admin','CHS_SECURITY_CHECKLIST_18_OCT_2026.pdf','Super admin','Security checklist'),
('3_Testing_and_Demo','CHS_OCT14_TEST_CHECKLIST.pdf','Testers','Numbered test checklist (tests 1-26 in repo .md)'),
('3_Testing_and_Demo','CHS_IPHONE_SETUP_AND_TEST_GUIDE.pdf','iPhone testers','Install on iPhone and test'),
('3_Testing_and_Demo','CHS_IPHONE_INSTALLATION_GUIDE.pdf','iPhone testers','Earlier iPhone installation guide'),
('3_Testing_and_Demo','CHS_IPHONE_TRIAL_PURCHASE_LOGINS.pdf','iPhone buyer + seller','CONTAINS TEST LOGINS - Kaduna duplex trial purchase'),
('3_Testing_and_Demo','CHS_TEST_STORE_GUIDE.pdf','Testers','Test store guide'),
('3_Testing_and_Demo','CHS_TEST_STORE_LOGINS.pdf','Testers','CONTAINS TEST LOGINS - test store'),
('3_Testing_and_Demo','CHS_DEMO_ACCOUNTS_LIST.pdf','Testers','CONTAINS TEST LOGINS - demo accounts'),
('3_Testing_and_Demo','CHS_DEMO_TESTING_ACCOUNTS.docx','Testers','CONTAINS TEST LOGINS - demo accounts (Word)'),
('3_Testing_and_Demo','CHS_Testing_Accounts.pdf','Testers','CONTAINS TEST LOGINS - earlier testing accounts'),
('3_Testing_and_Demo','CHS_TEST_ACCOUNTS.pdf','Testers','CONTAINS TEST LOGINS - Oct 12 test accounts'),
('3_Testing_and_Demo','CHS_ROUND2_DEMO_ACCOUNTS.pdf','Testers','CONTAINS TEST LOGINS - round 2'),
('3_Testing_and_Demo','CHS_RENT_TO_OWN_DEMO_ACCOUNTS.pdf','Testers','CONTAINS TEST LOGINS - rent-to-own'),
('3_Testing_and_Demo','CHS_RENT_TO_OWN_TESTING_GUIDE.pdf','Testers','Rent-to-own testing'),
('3_Testing_and_Demo','CHS_Rent_to_Own_Test_Guide.pdf','Testers','Rent-to-own test guide (earlier)'),
('3_Testing_and_Demo','CHS_RENT_TO_OWN_MORTGAGE_TEST_GUIDE.pdf','Testers','Rent-to-own / mortgage test'),
('3_Testing_and_Demo','CHS_VENDOR_AND_SERVICE_PROVIDER_TEST_GUIDE.pdf','Testers','Vendor and service provider test'),
('3_Testing_and_Demo','CHS_HOST_GUEST_DEMO_GUIDE.pdf','Testers','Host and guest demo'),
('3_Testing_and_Demo','CHS_SHORTLET_DEMO_GUIDE.pdf','Testers','Shortlet demo'),
('3_Testing_and_Demo','CHS_TENANT_INVITE_DEMO_GUIDE.pdf','Testers','Tenant invite demo'),
('3_Testing_and_Demo','CHS_HOSPITALITY_LIVE_WALKTHROUGH.pdf','Testers, team','Hospitality live walkthrough'),
('3_Testing_and_Demo','CHS_ROUND4_OBSERVATIONS_TRACKER.pdf','Team','Round 4 observations'),
('4_Setup_and_Operations','CHS_DOMAIN_EMAIL_SETUP_GUIDE.md','Owner, tech','Domain and email setup'),
('4_Setup_and_Operations','CHS_Domain_Email_Setup_Guide.pdf','Owner, tech','Domain and email setup (PDF)'),
('4_Setup_and_Operations','CHS_MULTIPLATFORM_DEPLOYMENT_EXPLAINER.pdf','Owner, tech','Web, Android and iPhone deployment'),
('4_Setup_and_Operations','CHS_HANDOVER_NOTES.pdf','Owner, tech','Handover notes'),
('4_Setup_and_Operations','CHS_COMPLETE_HANDOVER_PACKAGE.md','Owner, tech','Complete handover package'),
('4_Setup_and_Operations','CHS_OWNER_HANDOVER_AND_IDEAS.pdf','Owner','Owner handover and ideas'),
('4_Setup_and_Operations','CHS_System_Documentation.pdf','Tech','System documentation'),
('5_Reference_and_Audits','CHS_COMPLETE_FEATURE_CATALOG.pdf','Team','Feature catalog'),
('5_Reference_and_Audits','CHS_EXPLAINER_LIST.pdf','Team','Explainer list'),
('5_Reference_and_Audits','CHS_MANAGED_BY_CHS_IDENTITY.pdf','Team','Managed-by-CHS identity'),
('5_Reference_and_Audits','CHS_SECURITY_AUDIT_18_OCT_2026.pdf','Owner, tech','Security audit, updated'),
('5_Reference_and_Audits','CHS_PLACEHOLDER_AUDIT_18_OCT_2026.pdf','Owner, tech','Placeholder/demo audit'),
('5_Reference_and_Audits','CHS_DAMAGED_GOODS_CLAIMS_REFUNDS_DESIGN.pdf','Team','Claims and refunds design'),
('5_Reference_and_Audits','CHS_FIX_TRACKER.pdf','Team','Fix tracker'),
]
def find(n):
    c=[p for p in (os.path.join(D,n),os.path.join(O,n),os.path.join(R,n)) if os.path.exists(p)]
    return max(c,key=os.path.getmtime) if c else None
rows=[];miss=[]
for f,n,a,d in G:
    p=find(n)
    if not p: miss.append(n);continue
    os.makedirs(f'{V}/{f}',exist_ok=True); shutil.copy(p,f'{V}/{f}/{n}')
    rows.append((f,n,a,d,datetime.date.fromtimestamp(os.path.getmtime(p)).isoformat()))
# in-app text
def txt(s):
    s=re.sub(r'<h2[^>]*>','\n## ',s);s=re.sub(r'<h3[^>]*>','\n### ',s);s=re.sub(r'<li[^>]*>','\n- ',s);s=re.sub(r'<p[^>]*>','\n\n',s)
    s=re.sub(r'<[^>]+>','',s);return html.unescape(s)
g=open(R+'/chs-v2/components/GuideContent.tsx').read()
g=g[g.index('return ('):]
body=re.sub(r'\{[^{}]*\}','',txt(g)); body=re.sub(r'(?m)^[ \t]+','',body).replace('return (','');body=re.sub(r'\n{3,}','\n\n',body)
fq=open(R+'/chs-v2/components/FaqContent.tsx').read()
items=re.findall(r'q:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"',fq)
faq='# CHS FAQ (in-app text)\n\n'+'\n\n'.join(f'**Q: {q}**\n\n{a}' for q,a in items)
os.makedirs(V+'/6_In_App_Text',exist_ok=True)
open(V+'/6_In_App_Text/CHS_IN_APP_GUIDE_TEXT.md','w').write('# CHS In-App Users Guide (text of the /guide page)\n'+body)
open(V+'/6_In_App_Text/CHS_IN_APP_FAQ_TEXT.md','w').write(faq)
rows+= [('6_In_App_Text','CHS_IN_APP_GUIDE_TEXT.md','All users','Text of the /guide page',datetime.date.today().isoformat()),('6_In_App_Text','CHS_IN_APP_FAQ_TEXT.md','All users',f'Text of the /faq page ({len(items)} Q&As)',datetime.date.today().isoformat())]
idx=['# CHS GUIDES VAULT','',f'Updated: {datetime.date.today()}  |  {len(rows)} guides','',
'Standing rule: whenever a new guide is made it is added here and this zip is rebuilt, until app development is finished.','',
'Files marked CONTAINS TEST LOGINS hold practice-account logins. Share only with testers, and do not publish.','',
'Legal pack (Terms, Privacy, barrister issues), budgets and business plans are not guides and are kept outside this vault.','',
'| Folder | File | Audience | What it is | Date |','|---|---|---|---|---|']
idx+=[f'| {a} | {b} | {c} | {d} | {e} |' for a,b,c,d,e in rows]
idx+=['','Newest guide: CHS_TEAM_ACCESS_GUIDE.pdf (2_Staff_and_Admin)']
open(V+'/00_INDEX.md','w').write('\n'.join(idx))
Z='/mnt/user-data/outputs/CHS_GUIDES_VAULT.zip'
if os.path.exists(Z):os.remove(Z)
with zipfile.ZipFile(Z,'w',zipfile.ZIP_DEFLATED) as z:
    for r,_,fs in os.walk(V):
        for x in fs:
            p=os.path.join(r,x); z.write(p,'CHS_GUIDES_VAULT/'+os.path.relpath(p,V))
print(len(rows),'missing',miss,os.path.getsize(Z),len(items))
