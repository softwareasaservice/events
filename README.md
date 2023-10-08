# events, a minimal user journey automation package for Node/React

Build conversion and user journey automations based on events happening or not happening over a period of time.

Pass timeouts using the `ms` package which is the only dependency for this package.

The system is simple. You push/ingest events. And you have one workflow  function that is called automatically when an event in ingested, allowing you to build event-based automations. There are no cloud based or networking features. But you can over-ride the in-memory version for eg: to set and get from s3/a database, etc.

The innovation is a temporal/inngest style workflow/queing engine where the emphasis is on being developer friendly.


![image](https://github.com/importsaas/screenshots/blob/main/events/3line.png?raw=true)

## Demo 

Here is an example of 1 user generated event `app/email.submitted` triggering a workflow involving reminders for opening an account, for verifying email, and for creating 2 posts.

	creating event users[user1][app/email.submitted]
		waited 1s for account.created for user  { id: 'user1' }
	        send reminder to create account
	creating event users[user1][reminder/account.created]
		waited 2s for account.created for user  { id: 'user1' }
	        send reminder to create account
	creating event users[user1][reminder/account.created]
		waited 4s for account.created for user  { id: 'user1' }
	        send reminder to create account

	// notice exponential backoff for reminders

	creating event users[user1][reminder/account.created]
	creating event users[user1][app/account.created]
		waited 6s for app/email.verified
	        no email verified, wait for it
	creating event users[user1][app/email.verified]
	creating event users[user1][app/login]
	creating event users[user1][app/post.created]
		waited 2s for post2 created
	        send reminder to write post2
	creating event users[user1][app/post.created]
		waited 2s for post2 created
	        send reminder to write post2
	creating event users[user1][app/post.created]
		end of workflow
		
All times in this example have been made in seconds but you can very well replace it with `1d`, `7d` or minutes/seconds/days/weeks/months as you see fit.


## Code for the example workflow of 5 automations

	var Events = require('@softwareasaservice/events').Events;

    var events = new Events({workflow})	
      
    async function workflow({user}){
    	// read in-memory store events.users. 
        var data = events.users[user.id];
      
        // waitFor returns an object with {result:undefined|object}
        // result undefined meaning it's still not done

        // check if any reminders were sent
        var reminders = await events.waitFor(user, 'reminder/account.created', {match:{email: data.email}, timeout:'1s'});

        // then do exponential backoff reminders
        var expBackoff1 = (reminders.result? reminders.result.length*2:1)+'s';
        var userData = await events.waitFor(user, 'app/account.created', {match:{email: data.email}, timeout: expBackoff1});
        if(!userData.result){
            console.log('waited '+expBackoff1+' for account.created for user ', user);
            console.log('\tsend reminder to create account');
            return await events.ingest({event:'reminder/account.created', data:{email: data.email}, user:user});
        }

		// at this point user account is created
        user = userData.result[0];
        
        var emailVerified = await events.waitFor(user, 'app/email.verified', {match:{userId:user.id}, timeout:'6s'});

        if(emailVerified.result){
            var post1Created = await events.waitFor(user, 'app/post.created', {match:{id:'post1'}, timeout:'2s'});
            
            if(!post1Created?.result){
                console.log('waited 6s for post1 created');
                console.log('\tsend reminder to write post1');
                return;
            }else{
                var post2Created = await events.waitFor(user, 'app/post.created', {match:{id:'post2'}, timeout:'2s'});
                if(!post2Created?.result){
                    console.log('waited 2s for post2 created');
                    console.log('\tsend reminder to write post2');
                }else{
                    console.log('end of workflow');
 		            // return a result to end the workflow
		            return {result: post2Created}
                }
            }
        }else{
            console.log('waited 6s for app/email.verified');
            console.log('\tno email verified, wait for it');
        }
    }
    const events = new Events({workflow});

## Sleep

    // waits for 30 seconds
    await events.sleep("30s")

    // waits for 1 hour
    await events.sleep("1h")

    // anything passed in second argument is given back in the response
    var foo = await events.sleep("1h", {foo:"bar"}).foo
    
## Install

	# with yarn 
	yarn add @softwareasaservice/events
    
	# or with npm
	npm install @softwareasaservice/events

## Usage

    var Events = require('@softwareasaservice/events').Events;
    
    var events = new Events({workflow})


## Pushing events 

	var Events = require('@softwareasaservice/events').Events;

    var events = new Events({workflow:(){}})	
	// uses in-memory store 

    var user = {id: "user1"};
    var event = "someEvent";
    var data = {"foo":"bar", "level":2};

    // push events to in-memory store
    events.ingest({event, user, data})


## Replace in-memory store

	var Events = require('@softwareasaservice/events').Events;

	// To use your own stores, pass in your setter, getter functions
	var events = new Events({workflow, checkEvent, setEvent})

    // To use an S3 store
    // const {setup, checkEvent, setEvent} = require('@softwareasaservice/eventsWorkflowS3');
	var events = new Events({workflow, checkEvent, setEvent}, {
        S3:{
            OBJECT_STORE_PREFIX:'some-prefix-in-your-bucket/', 
            client: myS3Client // some s3 client that implements
                   // get(_path),list(_path), put(_path, jsonObj)
        }
    })

`checkEvent` and `setEvent` takes `{user, data, event}`. See the source code for learning how to create your own setters and getters that possibly read/write to a persistent storage like s3/minio or a database. 

## Licence
MIT

## Authors

importSaaS, a stealth startup that simplifies the SaaS journey for builders. 

Email `help@importsaas.com` to see how to self-host, share feedback, or to to say hello.
