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
        DATABASE_IP: 'localhost',
        DATABASE_PORT: 'db_port'
    },
    DATABASE_IPS: ['142.93.26.41',
        '159.65.103.1',
        '159.65.77.184',
        '206.189.216.212',
        'db_ip'
    ],

    general: {
        update_interval: 15 * 1000
    }
}