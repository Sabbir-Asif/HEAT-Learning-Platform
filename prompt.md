 I want to create a platform that will be an interactive learning platform for courses like

  preventing gender based violence in university campus. Important documents to watch before planning  

1. lms_production_implementation\_[plan.md , the](http://plan.md)he high level ideas are in the mentioned document.
2. HEAT Gender Safety Training Platform.png, a demo ui not the final one.



Now I will tell you some details for some modules of the project.   

1. Authentication
2. User can first see a public page containing the information and course information and the overview of the heat project. so that they get the initial idea. in that page there will show the course and some module of the course. these should be configurable via admin site. we can use tags, if we tag the course and the corresponding modeules as frontpage it should show it in the frontpage. on that section there will be a button enroll course. if the student press the button they will be in the enrolement page.
3. In the enrolement page the user needs to provide the informations for enrolement. the form will have two sections each with validation both in frontend and in backend. in the first. section the user needs to provide, name university name, faculty name, department name, session (2020-21, 2021-22) etc. then in the second section email, password, retype password, a backend custom generate captcha containing texts and numbers. then the user submits the request and enrole the course. the following are some more details for the form fields. \*   
\* university name, ( select, currently has one value for the list University of Dhaka, but in future there can be multiple), in the admin site there will page to create, read, update, remove university. an university can not be removed if any user is enrolled form that univeristy.  
\* Faculty ( select, faculty will be independent table and connected to the university, one university can contain multiple faculty and one faculty can be connected to multiple university.  
\* Departments (select, it will be connected to a university and a faculty)  
so that we can easily addopt multiple universities with each universities faculy and departments.   
\* name will be text field  
\* session will be text also but in this format eg. 2020-21
4. There needs to be email verification to send the emails later, but it can be done later, from the profile page. form the profile page the user can add their profile picture, change the name, chnage password, change password needs email verification.
5. there will be a forget password page, for this the user also needs email verification.
6. Without a verified email the user can not change a password and use forget password, and later the certificate collection.

Course management:  

1. there can be multiple courses so they remain in a table currently there will be one course availbale.
2. each course can contain multiple modules
3. each module can have multiple videos, but currently each module wil have only one video. but in later if multiple needed we need funtionality open for that.
4. with each module there will be a quiz.  
before passing each module the user can not unlock the next.

Certificate

each student only can avail certificate after they completed the course

certificate can be downloaded from the website also it will be mailed with a success email that the user completed the course with the attached certificate.

there need a public certificate validation page



Admin:

the public and admin site will be different nextjs app sharing the smae backend.

in the admin site only user with role admin can be added.

one super admin will be in the seed file and that super admin only can create another admin form a page from the admin site. there should be no registration page for admin. they can only signin. super admin controlls them.  
2. From the admin site the admin can create and configure courses, add/delete modules, add videos, quizes etc. evrything must be configurable.

3. there will be video processing pipeline, the admin can upload the video for the modules from the admin site and they will be processed via bull jobs.
4. any videos or courses configuration can not be changed if students are already enrolled to it.
5. admin can create university, create faculty assign faculty to university, create department assign department to a university faculty.

Technology;   
nestjs backend, nextjs frontend, postgres and prisma. all ohter technologies are mentioned int the plan md doc.   

the project will be hosted in one vps server.  
as this can have a lot of users like 10000 and 200 students can watch the course at a time multiple videos. so it is a very user facing high quality production grade software. so every decision you make should be very high quality, high securty and production grade. for the ui design use caludes forntend design, with open pencil, use shadcn compoent library. tailwind css. 

now for this project design the whole system, considering the high quality, create the high level plan, break down the plan into tasks, create github issues, create a github project and tag the issues.   
this project will be made by claude so follow calude best practices so that it can make a consistent production grade software without dropping the quality. use a claude hook before implementing each task it should pull the task ticket from the github, refine and clear the requirments adn update ticket, brainstrom and plan, implement, test, code review. then pr.  

for now only understand the requirements, create a high level project plan of how you will plan the whole project. and write it down in an html file as artifact.   
  
the logos for the project will use logos 4 logos available in this site  
[https://heat.ugc.gov.bd/](https://heat.ugc.gov.bd/)  
