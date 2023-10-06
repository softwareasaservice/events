import ms from 'ms'
const DEBUG = false

export class Events {
    constructor(opts) {
        opts = opts || {}
        this.opts = opts
        this.users = {}
        this.ingestToWorkflowQueue = {}
        this.workflow = opts.workflow || function () { }
        return this
    }
    async checkEvent({user, event, match}) {
        var _this = this
        if (_this.opts.checkEvent)
            return await _this.opts.checkEvent({user, event, match})
        var users = _this.users
        var ev = users[user.id]
        if(!match){
            return ev[event]
        }
        var _match = Object.entries(match)[0]
        if(DEBUG) console.log('looking for ', user.id , event, ' gave ', ev, ' look for ', match, ' gave ', _match)
        var matchKey = _match[0], matchVal = _match[1]
        if (!ev[event]) {
            if (DEBUG)
                console.log('\t\t\tno event ', event)
            return
        }
        var _matched = ev[event].filter(function (x) { return x[matchKey] == matchVal })
        //if(DEBUG) console.log(`\t\t[event=${event}]looking for `, user.id,' look for ', match, ' gave ', _matched,`\tcheck if event[${event}][${matchKey}] == ${matchVal}`);
        if(DEBUG) console.log('matched\t',_matched)
        if (_matched.length) {
            return _matched
        }
        else {
            // if(DEBUG) console.log('\t\tno match')
            return
        }
    }
    setEvent({user, data, event}) {
        var _this = this
        if (_this.opts.setEvent)
            return _this.opts.setEvent({user, data, event})
        var users = _this.users
        if (user) {
            if (!users[user.id]) {
                users[user.id] = Object.assign(Object.assign({}, user), {email: data.email})
                if (DEBUG)
                    console.log('created new user', user)
            }
        }
        if (!users[user.id][event]) {
            users[user.id][event] = []
        }
        users[user.id][event].push(Object.assign(Object.assign({}, data), {uts: Date.now()}))
        console.log(`creating event users[${user.id}][${event}]`)
    }
    async waitFor(user, event, {DEBUG, match, timeout}) {
        timeout = timeout || 0
        if (DEBUG) console.log(`\twait for ${timeout} for ${event}`)
        return await this.waitForTimeout(user, event, {match, timeout: timeout, timeoutMs: Date.now() + (timeout ? ms(timeout) : 0)})
    }

    waitForTimeout(user, event, {DEBUG, match, ctr, timeout, timeoutMs, done}) {
        var _this = this
        return new Promise(function (resolve, reject) {
            var now = Date.now()
            _this.checkEvent({user, event, match, DEBUG}).then(function(matched){
                var cont = matched || (now >= timeoutMs)
                ctr = ctr || 0
                if (!cont) {
                    setTimeout(function () {
                        _this.waitForTimeout(user, event, {ctr: ctr + 1, match, timeout, timeoutMs, done: {invokedBy: ctr, func: (done === null || done === void 0 ? void 0 : done.func) || resolve}})
                    }, 1000)
                }else {
                    var _result = {result: matched, user, event, timeout: timeout}
                    if (done) {
                        if (!done.func) {
                            return reject('no func')
                        }
                        else {
                            done.func(_result)
                        }
                    }
                    resolve(_result)
                }
            })
        })
    }
    async workflowLoop(param) {
        var _this = this
        var _done = await _this.workflow(param)
        if(!_done?.result){
            setTimeout(()=> { _this.workflowLoop(param) }, 500)
        }
    }
    async ingest(ev, opts) {
        var _this = this
        if (opts?.DEBUG) console.log('[NEW]', JSON.stringify(ev))
        if(!_this.users[ev.user.id]){
            _this.users[ev.user.id] = ev.data
            _this.workflowLoop({user:ev.user})
        }
        await _this.setEvent(ev)
    }
}