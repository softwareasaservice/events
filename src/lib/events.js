const ms = require('ms')
const DEBUG = false

export class Events {
    constructor(user, opts) {
        opts = opts || {}
        this.opts = opts
        this.user = user
        this.users = {}
        this.ingestToWorkflowQueue = {}
        this.inactive = false
        this.user = user
        this.workflow = opts.workflow || function () { }
        this.tick = opts.tick || '1m'
        this.setup()
        return this
    }
    async setup() {
        var _this = this
        if (_this.opts.setup){
            await _this.opts.setup(_this.opts, _this)
        }
    }
   
    async checkEvent({user, event}, opts) {
        var _this = this
        user = user ? user : _this.user
        if (_this.opts.checkEvent){
            return await _this.opts.checkEvent({user, event}, opts, _this)
        }
        var users = _this.users
        var ev = users[user.id]
        if (!opts.match) {
            return ev[event]
        }
        var _match = Object.entries(opts.match)[0]
        if (DEBUG) console.log('looking for ', user.id, event, ' gave ', ev, ' look for ', opts.match, ' gave ', _match)
        var matchKey = _match[0], matchVal = _match[1]
        if (!ev[event]) {
            if (DEBUG) console.log('\t\t\tno event ', event)
            return
        }
        var _matched = ev[event].filter(function (x) { return x[matchKey] == matchVal })
        //if(DEBUG) console.log(`\t\t[event=${event}]looking for `, user.id,' look for ', match, ' gave ', _matched,`\tcheck if event[${event}][${matchKey}] == ${matchVal}`);
        if (DEBUG)
            console.log('matched\t', _matched, ' inactive:',_this.inactive)
        if (_matched.length) {
            if(_this.inactive){
                if(DEBUG) console.log('inactive:', _this.inactive)
                return new Error('STOP')
            }else{
                return _matched
            }
        }
        else {
            // if(DEBUG) console.log('\t\tno match')
            return
        }
    }
    async setEvent({user, data, event}, opts) {
        var _this = this
        user = user ? user : _this.user
        if (_this.opts.setEvent)
            return _this.opts.setEvent({user, data, event}, opts, _this)
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

    setInactive(_bool) {
        if(_bool != this.inactive){
            this.inactive = _bool
            console.log('\tchanging inactive to ', _bool)
        }
    }

    async waitFor(user, event, opts) {
        var _this = this
        var {DEBUG, timeout} = opts || {}
        timeout = timeout || 0
        user = user ? user : _this.user
        return await this.waitForTimeout(user, event, {...opts, timeoutMs: Date.now() + (timeout ? ms(timeout) : 0)})
            .catch((err) => {
                if(DEBUG) console.log('stop waitFor', err)
                return null
            })
    }

    async waitForTimeout(user, event, opts) {
        var _this = this
        user = user ? user : _this.user
        return new Promise(function (resolve, reject) {
            opts = opts || {}
            var {DEBUG, ctr, timeout, timeoutMs, done} = opts
            var now = Date.now()
            if(!timeout){
                timeout = _this.tick
            }
            _this.checkEvent({user, event}, opts, _this).then(function (matched) {
                if(matched instanceof Error){
                    if (DEBUG) console.log('waitForTimeout err:', matched)
                    return setTimeout(function () {
                        _this.waitForTimeout(user, event, {...opts, ctr: ctr + 1, done: {invokedBy: ctr, func: (done === null || done === void 0 ? void 0 : done.func) || resolve}})
                    }, ms(timeout))
                }
                var cont = matched || (now >= timeoutMs)
                ctr = ctr || 0
                if (!cont) {
                    setTimeout(function () {
                        _this.waitForTimeout(user, event, {...opts, ctr: ctr + 1, done: {invokedBy: ctr, func: (done === null || done === void 0 ? void 0 : done.func) || resolve}})
                    }, ms(timeout))
                }
                else {
                    var _result = {result: matched, user, event, timeout, ctr}
                    if (done) {
                        if (!done.func) {
                            return reject('no func')
                        }
                        else {
                            delete _result.opts?.done
                            done.func(_result)
                        }
                    }
                    resolve(_result)
                }
            }).catch(err => {
                if(DEBUG) console.log('waitForTimeout got err, wait or stop?', err)
            })
        })
    }

    async sleep(timeout, opts){
        opts = opts || {}
        return await this._sleep({...opts, timeout, timeoutMs: Date.now() + (timeout ? ms(timeout) : 0)})
    }

    async _sleep(opts) {
        var _this = this
        return new Promise(function (resolve, reject) {
            var {ctr, timeout, timeoutMs, done} = opts
            var now = Date.now()
            var cont = (now >= timeoutMs)
            ctr = ctr || 0
            if (!cont) {
                setTimeout(function () {
                    _this._sleep({...opts, ctr: ctr + 1, done: {invokedBy: ctr, func: (done === null || done === void 0 ? void 0 : done.func) || resolve}})
                }, 1000)
            }
            else {
                var _result = {user: _this.user, opts, result:timeout, timeout, ctr}
                if (done) {
                    if (!done.func) {
                        return reject('no sleep func')
                    }
                    else {
                        delete _result.opts?.done
                        done.func(_result)
                    }
                }
                resolve(_result)
            }
        })
    }

    async workflowLoop(param, ev) {
        var _this = this, _done
        if(!_this.inactive){
            _done = await _this.workflow(param, ev, _this)
        }
        var _stop = false
        if(Array.isArray(_done)) {
            _stop = _done.filter(x => x)
            _stop = _stop.length ? true : false
        }
        if(_stop){
            //console.log('\tnot done, so continue ');
            _this.stopped = true;
        }else{
            //console.log('\tdone has data for atleast 1 promise, so discontinue ');
            setTimeout(() => { _this.workflowLoop(param, ev) }, ms(_this.tick))
        }
    }

    async ingest(ev, opts) {
        var _this = this
        await _this.setEvent(ev, opts, _this)
        var user = ev.user? ev.user : _this.user
        if (!_this.users[user.id]) {
            _this.users[user.id] = ev.data
        }
        if(!opts?.system && _this.stopped){
            _this.stopped = false;
            _this.workflowLoop({user: user}, ev)
        }
    }
}