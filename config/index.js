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
    jump_bikes: {
        url: 'https://dc.jumpmobility.com/opendata/free_bike_status.json'
    },
    skip_scooters: {
        url: 'https://us-central1-waybots-production.cloudfunctions.net/dcFreeBikeStatus'
    },
    spin_bikes: {
        url: 'https://web.spin.pm/api/gbfs/v1/free_bike_status',
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
        DATABASE_IP: '142.93.29.51',
        DATABASE_PORT: 'db_port'
    },
    geojson: {
        settings: {
            Point: ['lat', 'lng']
        }
    },
    general: {
        update_interval: 5 * 1000
    }
}