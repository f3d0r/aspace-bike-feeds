module.exports = {
    getBikes: function () {
        return {
            method: 'GET',
            url: 'https://us-central1-waybots-production.cloudfunctions.net/dcFreeBikeStatus',
            headers: {
                authorization: 'Bird eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJBVVRIIiwidXNlcl9pZCI6IjM2ZjYxOGM2LTNjZDgtNGQ2Ny1hNTAzLTQ2MDEzYWU5ZjkwMCIsImRldmljZV9pZCI6Ijk5MWUxN2U3LWZjMjctNDE1Ni05MGY0LTZlMTAxOGJlMTU1ZCIsImV4cCI6MTU2NTg4ODA4Mn0.2fAAlG8uySRh3FnSyjZtATzRZRCYt8C14UYbAZsraRg'
            },
            json: true
        };
    }
}