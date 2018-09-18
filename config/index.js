module.exports = {
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
    slack: {
        webhook: '***REMOVED***'
    },
    db: {
        DATABASE_USER: 'api',
        DATABASE_PASSWORD: 'db_password',
        DATABASE_NAME: 'aspace',
        DATABASE_IP: '159.89.131.95',
        DATABASE_PORT: 'db_port'
    },
    general: {
        update_interval: 20 * 1000
    }
}