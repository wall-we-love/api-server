/**
 * Created by Jordan on 5/20/2015.
 */
'use strict';

var path        = require('path');
var router      = require('koa-router');
var crypto      = require('crypto');
var request     = require('request-promise');
var koaBody     = require('koa-body');
var koa         = require('koa');
var cors        = require('koa-cors');
var Promise     = require('bluebird');
var bcrypt      = Promise.promisifyAll(require('bcrypt'));
var Joi         = Promise.promisifyAll(require('joi'));

var models  = require('./models');

var app = koa();

app.use(function *(next) {
    try {
        yield next;
    } catch (e) {
        if (e.name === 'ValidationError') {

            this.status = 400;
            this.body = {
                ValidationError: e.message
            }

        } else if (e.status) {

            this.status = e.status;
            this.body = {};
            this.body[e.name] = e.message;

        } else {

            this.status = 500;
            this.body = {
                InternalServerError: ":'("
            };

            console.error(e.name);
            console.error(e.message);
            console.error(e.stack);

        }
    }
});

app.use(function *(next) {
    yield next;
    this.response.headers['access-control-allow-headers'] = this.request.headers['access-control-request-headers'];
});

app.use(cors());


app.use(router(app));

app.post('/user/register/email',
    koaBody(),
    function *(next) {

        yield Joi.validateAsync(
            this.request.body,
            {
                email: Joi.string().email().required(),
                password: Joi.string().required()
            }
        );

        yield next;

    },
    function *(next) {

        try {
            let user = yield models.User.create({
                email: this.request.body.email,
                password: yield bcrypt.hashAsync(this.request.body.password, 12)
            });
            this.body = user.get();

            this.status = 201;

            yield next;
        } catch (e) {
            if (e.name === 'SequelizeUniqueConstraintError') {
                this.throw(409);
            } else {
                throw e;
            }
        }

    }
);

function *emailLogin(next) {
    if (!this.headers['authorization']) return this.throw(400);

    let headerTokenValueEnc = this.headers['authorization'].substr(5);
    this.assert(headerTokenValueEnc, 400, 'Token bad format (1)');

    let headerTokenValue = new Buffer(headerTokenValueEnc, 'base64').toString();

    let passwordStartPosition = headerTokenValue.indexOf(':');
    this.assert(passwordStartPosition > 0, 400, 'Token bad format (2)');

    let email = headerTokenValue.substr(0, passwordStartPosition);
    let password = headerTokenValue.substr(passwordStartPosition + 1);

    let user = this.state.user = yield models.User.findOne({ where: { email: email } });
    this.assert(user, 401, 'No such user (1)');

    let validPassword = bcrypt.compareAsync(password, user.password);
    this.assert(validPassword, 401, 'Bad password');

    yield next;
}

function *facebookLogin(next) {
    this.assert(this.request.body.access_token, 400, 'Access token required');
    let transaction = yield models.sequelize.transaction();

    try {
        console.log(1);
        let appsecret_proof = crypto.createHmac('sha256', process.env.FACEBOOK_APP_SECRET).update(this.request.body.access_token).digest('hex');
        console.log(2);
        let facebookRequest = yield request('https://graph.facebook.com/me?access_token=' + this.request.body.access_token + '&appsecret_proof=' + appsecret_proof);
        console.log(3);
        let facebookProfile = JSON.parse(facebookRequest);
        console.log(4);
        let user = yield models.User.findOne({ where: models.Sequelize.or({ email: facebookProfile.email }, { facebookId: facebookProfile.id }), transaction: transaction });
        console.log(5);

        if (!user) {
            user = yield models.User.create({
                email: facebookProfile.email,
                facebookId: facebookProfile.id
            }, { transaction: transaction });
            user.created = true;
        } else {
            user.email = facebookProfile.email;
            user.facebookId = facebookProfile.id;
            user = yield user.save();
        }

        this.state.user = user;
        transaction.commit();
        yield next;

    } catch (e) {
        console.log(e.stack);
        transaction.rollback();
        return this.throw(401, 'Bad access token');
    }
}

function *tokenLogin(next) {
    this.assert(this.headers['authorization'], 400, 'Missing auth token');

    let headerTokenValue = this.headers['authorization'].substr(7);
    if (!headerTokenValue) return this.throw(400);

    let authToken = this.state.authToken = yield models.AuthToken.findOne({ where: { value: headerTokenValue } });
    if (!authToken) return this.throw(401);

    let user = this.state.user = yield authToken.getUser();
    if (!user) return this.throw(500);

    yield next;
}

function *issueToken(next) {
    this.body = yield models.AuthToken.create({ userId: this.state.user.id });
    this.status = 201;

    yield next;
}

app.post('/user/token/email',
    emailLogin,
    issueToken
);

app.post('/user/token/facebook',
    koaBody(),
    facebookLogin,
    issueToken
);

app.get('/posters',
    function *(next) {

        this.body = yield models.Poster.findAll({
            attributes: ['id', 'pos_x', 'pos_y']
        });

        this.status = 200;

        yield next;

    }
);

app.get('/posters/:posterId',
    function *(next) {

        let poster = yield models.Poster.findOne({
            where: { id: this.params.posterId }
        });

        if (!poster) return this.throw(404);

        this.body = poster.get();
        this.status = 200;

        yield next;

    }
);

app.get('/posters/:posterId/file',
    function *(next) {
        let poster = yield models.Poster.findOne({
            where: { id: this.params.posterId }
        });

        if (!poster) return this.throw(404);

        this.body = poster.get();
        yield next;
    }
);

app.post('/posters',
    tokenLogin,
    koaBody(),
    function *(next) {

        let transaction = yield models.sequelize.transaction();

        try {
            let poster = yield models.Poster.create({
                name: this.request.body.name,
                description: this.request.body.description,
                pos_x: this.request.body.pos_x,
                pos_y: this.request.body.pos_y,
                width: this.request.body.width,
                height: this.request.body.height,
                fileData: this.request.body.fileData,
                userId: this.state.user.id
            });
            transaction.commit();
            this.body = poster.get();
            this.status = 201;

        } catch (e) {
            transaction.rollback();
            throw e;
        }

        yield next;
    }
);

app.get('/me',
    tokenLogin,
    function *(next) {
        this.body = this.state.user.get();
        this.status = 200;

        yield next;
    }
);

module.exports = app;