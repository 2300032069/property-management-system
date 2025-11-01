'use strict';

const debugMode = process.env.NODE_ENV !== 'production';

const logger = require('winston');
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    level: process.env.LOCA_LOGGER_LEVEL || process.env.LOGGER_LEVEL || 'debug',
    colorize: true
});

const i18next = require('i18next');
const i18nMiddleware = require('i18next-express-middleware');
const {
    LanguageDetector
} = require('i18next-express-middleware');
const i18nFS = require('i18next-node-fs-backend');
const i18nSprintf = require('i18next-sprintf-postprocessor');
const Intl = require('intl');
const express = require('express');
const favicon = require('serve-favicon');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const session = require('express-session');
const errorHandler = require('errorhandler');
const passport = require('passport');
const expressWinston = require('express-winston');
const path = require('path');
const moment = require('moment');
const config = require('./config');
const indexRouter = require('./backend/routes/index');
const db = require('./backend/models/db');
const ejsHelpers = require('./backend/pages/ejshelpers');

const root_directory = __dirname;
const dist_directory = path.join(root_directory, 'dist');

i18next.use(LanguageDetector)
    .use(i18nFS)
    .use(i18nSprintf)
    .init({
        debug: false,
        fallbackLng: 'en',
        pluralSeparator: '_',
        keySeparator: '::',
        nsSeparator: ':::',
        detection: {
            order: ['cookie', 'header'],
            lookupCookie: 'locaI18next',
            cookieDomain: 'loca',
            caches: ['cookie']
        },
        backend: {
            loadPath: path.join(dist_directory, 'locales', '{{lng}}.json')
        }
    });

const app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(session({
    secret: 'loca-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 5 * 60 * 1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(i18nMiddleware.handle(i18next));
app.use(function(req, res, next) {
    app.locals.Intl = {
        NumberFormat: new Intl.NumberFormat(req.language, {
            maximumSignificantDigits: 2
        }),
        NumberFormatCurrency: new Intl.NumberFormat(req.language, {
            style: 'currency',
            currency: 'USD',
        })
    };
    const splitedLanguage = req.language.split('-');
    moment.locale(splitedLanguage[0]);
    next();
});

app.use(favicon(path.join(dist_directory, 'images', 'favicon.png'), {
    maxAge: 2592000000
}));
app.use('/node_modules', express.static(path.join(root_directory, 'node_modules')));
app.use('/public', express.static(dist_directory));
app.use('/public/image', express.static(path.join(dist_directory, 'images')));
app.use('/public/images', express.static(path.join(dist_directory, 'images')));
app.use('/public/fonts', express.static(path.join(root_directory, '/node_modules/bootstrap/fonts')));
app.use('/public/pdf', express.static(path.join(dist_directory, 'pdf')));
app.use('/robots.txt', express.static(path.join(dist_directory, 'robots.txt')));
app.use('/sitemap.xml', express.static(path.join(dist_directory, 'sitemap.xml')));

app.set('views', path.join(__dirname, 'backend', 'pages'));
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(expressWinston.logger({
    transports: [
        new logger.transports.Console({
            json: false,
            colorize: true
        })
    ],
    meta: false,
    msg: String,
    expressFormat: true,
    colorStatus: true
}));
app.use(expressWinston.errorLogger({
    transports: [
        new logger.transports.Console({
            json: false,
            colorize: true
        })
    ]
}));

indexRouter.forEach(route => {
    if (typeof route === 'function') {
        app.use(route());
    } else {
        app.use(route);
    }
});


if (debugMode) {
    app.use(errorHandler());
}

app.locals = {
    ...app.locals,
    ...ejsHelpers
};

db.init()
    .then(() => {
        const http_port = process.env.LOCA_NODEJS_PORT || process.env.PORT || 8082;
        app.listen(http_port, function() {
            logger.info('Listening port ' + http_port);
            if (!debugMode) {
                logger.info('In production mode');
            } else {
                logger.info('In development mode (no minify/no uglify)');
            }
            if (config.demomode) {
                logger.info('In demo mode (login disabled)');
            }
            const configdir = process.env.LOCA_CONFIG_DIR || process.env.CONFIG_DIR || path.join(__dirname, 'config');
            logger.debug('loaded configuration from', configdir);
            logger.debug(JSON.stringify(config, null, '\t'));
            if (debugMode) {
                const LiveReloadServer = require('live-reload');
                LiveReloadServer({
                    _: ['dist'],
                    port: 9091
                });
            }
        });
    })
    .catch((err) => {
        logger.error(err);
        process.exit(1);
    });
