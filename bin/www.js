/**
 * Created by Jordan on 5/20/2015.
 */
'use strict';

require('../models').sequelize.sync({ force: true })
    .then(function () {
        require('../index').listen(process.env.PORT, function () {
            console.log('Listening on', process.env.PORT);
        });
    }).catch(console.error);