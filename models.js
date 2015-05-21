/**
 * Created by Jordan on 5/20/2015.
 */
'use strict';

var Sequelize   = exports.Sequelize = require('sequelize');
var sequelize   = exports.sequelize = new Sequelize(process.env.DB_URI);

var User = exports.User = sequelize.define('user', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
    },
    email: {
        type: Sequelize.STRING,
        validate: {
            isEmail: true
        },
        unique: true
    },
    password: Sequelize.STRING,
    facebookId: Sequelize.STRING,
    twitterId: Sequelize.STRING
});

var Poster = exports.Poster = sequelize.define('poster', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
    },
    name: Sequelize.STRING,
    description: Sequelize.STRING,
    pos_x: Sequelize.INTEGER,
    pos_y: Sequelize.INTEGER
});

var AuthToken = exports.AuthToken = sequelize.define('auth-token', {
    value: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
    }
});

User.hasMany(Poster);
Poster.belongsTo(User);

User.hasMany(AuthToken);
AuthToken.belongsTo(User);