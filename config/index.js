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
    mysql_config: {
        ADMIN_TABLE: 'aspace_admins'
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
    general: {
        update_interval: 20 * 1000
    }
}