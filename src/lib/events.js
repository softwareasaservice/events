import ms from 'ms'
const DEBUG=false

export class Events { 
    constructor(opts){
        opts = opts || {}
        this.opts = opts
        this.users = {}
        this.ingestToWorkflowQueue = {}
        this.workflow = opts.workflow || function(){}
        return this
    }

    checkEvent ({user, event, match}) {
        var _this = this
        if(_this.opts.checkEvent) return _this.opts.checkEvent({user, event, match})
        if(DEBUG) console.log('checkEvent ', match)
        var users = _this.users
        //var ev = JSON.parse(fs.readFileSync("./ev.json").toString())
        var ev = users[user.id]
        var _match = Object.entries(match)[0]
        //if(DEBUG) console.log('looking for ', user.id , event, ' gave ', ev, ' look for ', match, ' gave ', _match);
        var matchKey = _match[0], matchVal = _match[1]
        if(!ev[event]){
            if(DEBUG) console.log('\t\t\tno event ', event)
            return
        }
        var _matched = ev[event].filter(function(x){ return x[matchKey]== matchVal})
        //if(DEBUG) console.log(`\t\t[event=${event}]looking for `, user.id,' look for ', match, ' gave ', _matched,`\tcheck if event[${event}][${matchKey}] == ${matchVal}`);
        //if(DEBUG) console.log('matched\t',_matched);
        if(_matched.length){
            return _matched
        }else{
            // if(DEBUG) console.log('\t\tno match')
            return
        }
    }

    setEvent ({user, data, event}) {
        var _this = this
        if(_this.opts.setEvent) return _this.opts.setEvent({user, data, event})

        var users = _this.users
        if(user){
            if(!users[user.id]){
                users[user.id] = {...user, email:data.email}
                if(DEBUG) console.log('created new user', user)
            }
        }
        if(!users[user.id][event]){
            users[user.id][event] = []
        }
        
        users[user.id][event].push({...data,uts:Date.now()})
        console.log(`creating event users[${user.id}][${event}]`)
    }

    async waitFor (user, event, {DEBUG, match, timeout}) {
        timeout = timeout || 0;
        if(DEBUG) console.log(`\twait for ${timeout} for ${event}`)
        return await this.waitForTimeout(user, event, {match, timeout: timeout, timeoutMs:Date.now() + (timeout? ms(timeout):0)})
    }

    waitForTimeout (user, event, {DEBUG, match, ctr, timeout, timeoutMs, done}) {
        var _this = this
        return new Promise(function(resolve,reject){
            var now = Date.now()
            var matched = _this.checkEvent({user, event, match, DEBUG})
            var cont = matched || (now >= timeoutMs)
            ctr = ctr || 0
            if(DEBUG) console.log('flipping ',ctr, ' time ? ', (now > timeoutMs), ' condition ? ', cont);

            if(!cont){
                setTimeout(function() {
                    if(DEBUG) console.log('\t\t\t wait for 1250')
                    _this.waitForTimeout(user, event, {ctr:ctr+1, match, timeout, timeoutMs, done:{invokedBy:ctr, func:done?.func||resolve}})
                }, 1250)
            }else{
                if(DEBUG) console.log('\tfinally done, matched is ', matched,' done is ', done)
                var _result = {result:matched, user, event, timeout:timeout}
                if(done){
                    //if(DEBUG) console.log('\t\tcalling done with ', ctr);
                    if(!done.func){
                        return reject('no func')
                    }else{
                        done.func(_result)
                    }
                }
                resolve(_result)
            }
        })
    }

    ingest (ev, opts)  {
        var _this = this
        var DEBUG
        if(opts){
            DEBUG = opts.DEBUG
        }

        if(DEBUG) console.log('[NEW]', JSON.stringify(ev))
        
        _this.setEvent(ev)
        var user = ev.user
        setTimeout(function() {
            if(!_this.ingestToWorkflowQueue[user.id]){
                _this.ingestToWorkflowQueue[user.id]=1
                _this.workflow({user}) 
                setTimeout(function() {
                    delete _this.ingestToWorkflowQueue[user.id]
                }, 1000)
            }
        }, 100)
    }
}