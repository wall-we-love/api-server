/**
 * Created by Jordan on 5/20/2015.
 */
'use strict';

var path        = require('path');
var router      = require('koa-router');
var koaBody     = require('koa-body');
var koa         = require('koa');
var cors        = require('koa-cors');
var Promise     = require('bluebird');
var fs          = Promise.promisifyAll(require('fs'));
var Joi         = Promise.promisifyAll(require('joi'));
var send        = require('koa-send');

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
    this.response.headers['access-control-allow-headers']= this.request.headers['access-control-request-headers'];
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
            let user = yield models.User.create(this.request.body);
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
    if (!this.headers['Authorization']) return this.throw(400);

    let headerTokenValueEnc = this.headers['Authorization'].substr(5);
    if (!headerTokenValueEnc) return this.throw(400);

    let headerTokenValue = new Buffer(headerTokenValueEnc, 'base64').toString();

    let passwordStartPosition = headerTokenValue.indexOf(':');
    if (passwordStartPosition <= 0) return this.throw(400);

    let email = headerTokenValue.substr(0, passwordStartPosition);
    let password = headerTokenValue.substr(passwordStartPosition + 1);

    let user = this.state.user = yield models.user.findOne({ where: { email: email, password: password } });
    if (!user) return this.throw(401);

    yield next;
}

function *tokenLogin(next) {
    yield Joi.validateAsync(this.headers['Authorization'], Joi.string().required);

    let headerTokenValue = this.headers['Authorization'].substr(6);
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

        yield send(this, poster.id, { root: process.env.UPLOAD_DIR });
        yield next;
    }
);

app.post('/posters',
    tokenLogin,
    koaBody({ multipart: true }),
    function *(next) {

        let transaction = yield models.sequelize.transaction();

        try {

            let tmpFile = this.request.body.files[Object.keys(this.request.body.files)[0]];
            let poster = yield models.Poster.create({
                name: this.request.body.name,
                description: this.request.body.description,
                pos_x: this.request.body.pos_x,
                pos_y: this.request.body.pos_y,
                userId: this.state.user.id
            });
            yield fs.renameAsync(tmpFile.path, path.join(process.env.UPLOAD_DIR, poster.id));
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

module.exports = app;