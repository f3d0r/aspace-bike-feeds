var db = require('./db');

module.exports = {
    addObjects: async function (database, keys, objects) {
            var connections = await db.getConnections();
            return new Promise(function (resolveAll, rejectAll) {
                var reqs = []
                connections.forEach(function (connection) {
                    reqs.push(new Promise(function (resolve, reject) {
                        var sql = 'INSERT INTO ' + connection.escapeId(database) + ' (`' + keys[0] + '`';
                        for (index = 1; index < keys.length; index++) {
                            sql += ', `' + keys[index] + '` '
                        }
                        sql += ') VALUES ?';
                        connection.query(sql, [objects], function (error, results, fields) {
                            connection.release();
                            if (error) {
                                reject(error);
                            } else {
                                resolve(results);
                            }
                        });
                    }));
                });
                Promise.all(reqs)
                    .then(function (responses) {
                        resolveAll(responses);
                    })
                    .catch(function (error) {
                        rejectAll(error);
                    });
            });
        },
        select: {
            regularSelect: async function (database, selection, keys, operators, values, numResults) {
                var connections = await db.getConnections();
                return new Promise(function (resolveAll, rejectAll) {
                    var reqs = [];
                    connections.forEach(function (connection) {
                        var sql = 'SELECT ';
                        if (selection == null || selection == "*") {
                            sql += '*';
                        } else {
                            sql += selection[0] + ' ';
                            for (index = 1; index < selection.length; index++) {
                                sql += ', ' + selection[index]
                            }
                        }
                        sql += ' FROM ' + connection.escapeId(database) + ' WHERE ';
                        if (keys.length != operators.length || operators.length != values.length)
                            return reject('Key length must match value length.');
                        for (var index = 0; index < keys.length; index++) {
                            if (index < keys.length - 1)
                                sql += "`" + keys[index] + "` " + operators[index] + " ? AND ";
                            else
                                sql += "`" + keys[index] + "` " + operators[index] + " ?";
                        }
                        reqs.push(new Promise(function (resolve, reject) {
                            connection.query(sql, values, function (error, rows) {
                                connection.release();
                                if (error)
                                    reject(error);
                                else if (numResults == null)
                                    resolve(rows)
                                else if (numResults != null && rows.length == 0)
                                    resolve([]);
                                else
                                    resolve(rows);
                            });
                        }))
                    });
                    Promise.all(reqs)
                        .then(function (responses) {
                            resolveAll(responses);
                        })
                        .catch(function (error) {
                            rejectAll(error);
                        });
                });
            }
        },
        remove: {
            regularDelete: async function (database, keys, values) {
                var connections = await db.getConnections();
                return new Promise(function (resolveAll, rejectAll) {
                    connections.forEach(function (connection) {
                        var sql = "DELETE FROM " + connection.escapeId(database) + " WHERE ";
                        if (keys.length != values.length)
                            return reject('Key length must match value length.');
                        for (var index = 0; index < keys.length; index++)
                            if (index < keys.length - 1)
                                sql += "`" + keys[index] + "` = ? AND ";
                            else
                                sql += "`" + keys[index] + "` = ?";
                        var reqs = [];
                        reqs.push(new Promise(function (resolve, reject) {
                            connection.query(sql, values, function (error, rows) {
                                connection.release();
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(rows);
                                }
                            });
                        }));
                    });
                    Promise.all(reqs)
                        .then(function (responses) {
                            resolveAll(responses);
                        })
                        .catch(function (error) {
                            rejectAll(error);
                        });
                });
            }
        }
}