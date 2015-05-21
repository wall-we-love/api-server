/**
 * Created by Jordan on 5/21/2015.
 */
'use strict';

var hippie = require('hippie');

var app = require('../index');
var models = require('../models');

describe('user', function () {
    describe('register', function () {

        beforeEach(function (done) {
            models.sequelize.sync({ force: true })
                .then(function () { done() });
        });

        it('should return a 400, No data', function (done) {
            hippie(app)
                .post('/user/register/email')
                .expectStatus(400)
                .end(done);
        });

        it('should return a 400, No email', function (done) {
            hippie(app)
                .post('/user/register/email')
                .json()
                .send({ password: 'YOLO42' })
                .expectStatus(400)
                .end(done);
        });

        it('should return a 400, No password', function (done) {
            hippie(app)
                .post('/user/register/email')
                .json()
                .send({ email: 'jean@gmail.com' })
                .expectStatus(400)
                .end(done);
        });

        it('should return a 400, bad email', function (done) {
            hippie(app)
                .post('/user/register/email')
                .json()
                .send({ email: 'jean', password: 'YOLO42' })
                .expectStatus(400)
                .end(done);
        });

        it('should return a 201', function (done) {
            hippie(app)
                .post('/user/register/email')
                .json()
                .send({ email: 'jean@gmail.com', password: 'YOLO42' })
                .expectStatus(201)
                .end(done);
        });

        it('should return a 409, email already exist', function (done) {
            hippie(app)
                .post('/user/register/email')
                .json()
                .send({ email: 'jean@gmail.com', password: 'YOLO42' })
                .expectStatus(201)
                .end(function (err) {
                    if (err) done(err);
                    hippie(app)
                        .post('/user/register/email')
                        .json()
                        .send({ email: 'jean@gmail.com', password: 'YOLO42' })
                        .expectStatus(409)
                        .end(done)
                });
        });

    });
});