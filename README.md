# events, a minimal user journey automation pacakge for Node/React

Build conversion and user journey automations based on events happening or not happening without a period of time.

Pass timeouts using the `ms` package which is the only dependency for this package.

## Install

    # with yarn 
    yarn add @softwareasaservice/events
    
    # or with npm
    npm install @softwareasaservice/events


## Usage

    var Events = require('@softwareasaservice/events').Events;
    
    var events = new Events({workflow})

A workflow is the function that is called after every event in ingested, allowing your to build event-based automations.


## Pushing events 

## Example workflow with 5 automations

	var Events = require('@softwareasaservice/events').Events;

    var events = new Events({workflow:(){}})	
	// uses in-memory store 

    var user = {id: "user1"};
    var event = "someEvent";
    var data = {"foo":"bar", "level":2};

    // push events to in-memory store
    events.ingest({event, user, data})

## Example output of workflow with 5 automations

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

## Code for example workflow with 5 automations

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
            console.log('waited '+expBackoff1+' for account.created for user ', user);// since userData was ', userData, ' event:',event, ' user:', user, ' data:', data);
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
                }
            }
        }else{
            console.log('waited 6s for app/email.verified');
            console.log('\tno email verified, wait for it');
        }
    }
    const events = new Events({workflow});


## Replace in-memory store

	var Events = require('@softwareasaservice/events').Events;

	// To use your own stores, pass in your setter, getter functions
	var events = new Events({workflow, checkEvent, setEvent})


## Adding to the queue
    
    var user = {id:"user1"};
    var event = "app/email.verified"
    var data = {"foo":"bar"};
    events.ingest({user, event, data});
      

## Licence
MIT

## Authors

importSaaS, a stealth startup that simplifies the SaaS journey for builders. 

Email `help@importsaas.com` to see how to self-host, share feedback, or to to say hello.