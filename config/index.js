module.exports = {
    express: {
        RESPONSE_TIMEOUT_MILLI: 30000
    },
    limebike: {
        url: 'https://lime.bike/api/partners/v1/bikes',
        token_prefix: 'Bearer',
        token: 'limebike-PMc3qGEtAAXqJa',
        regions: ['Seattle', 'Washington DC Proper'],
    },
    twilio: {
        TWILIO_ACCOUNT_SID: 'twilio_sid',
        TWILIO_AUTH_TOKEN: 'twilio_auth_token',
        ORIGIN_PHONE: 'twilio_origin_phone_number'
    },
    mysql_config: {
        ADMIN_TABLE: 'aspace_admins'
    },
    auth: {
        PIN_EXPIRY_MINUTES: 5,
        INTERNAL_AUTH_KEY: '***REMOVED***'
    },
    bcrypt: {
        SALT_ROUNDS: 10
    },
    sensors: {
        sensorDeltaFeet: 2
    },
    slack: {
        webhook: '***REMOVED***'
    },
    db: {
        DATABASE_USER: 'api',
        DATABASE_PASSWORD: 'db_password',
        DATABASE_NAME: 'aspace',
        DATABASE_IP: '206.189.175.212',
        DATABASE_PORT: 'db_port'
    },
    geojson: {
        settings: {
            Point: ['lat', 'lng']
        }
    },
    mapbox: {
        API_KEY: '***REMOVED***'
    }
}