var db = require('./db');
var mysql = require('mysql');
var uniqueString = require('unique-string');

module.exports = {
    insert: {
        addObjects: function (database, objects, successCB, failCB) {
            db.getConnection(function (err, connection) {
                formattedObjects = [];
                objects.forEach(function (currentRaw) {
                    formattedObjects.push([currentRaw.company, currentRaw.id, currentRaw.num, currentRaw.type, currentRaw.lat, currentRaw.lng]);
                });
                var sql = 'INSERT INTO ' + connection.escapeId(database) + ' (`company`, `id`, `num`, `type`, `lat`, `lng`) VALUES ?';
                connection.query(sql, [formattedObjects], function (error, results, fields) {
                    if (error) {
                        return failCB(error);
                    } else {
                        successCB(results);
                    }
                });
                connection.release();
            });
        },
    },
    select: {
        regularSelect: function (database, selection, keys, operators, values, numResults, successCB, noneFoundCB, failCB) {
            db.getConnection(function (err, connection) {
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
                    return failCB('Key length must match value length.');
                for (var index = 0; index < keys.length; index++) {
                    if (index < keys.length - 1)
                        sql += "`" + keys[index] + "` " + operators[index] + " ? AND ";
                    else
                        sql += "`" + keys[index] + "` " + operators[index] + " ?";
                }
                connection.query(sql, values, function (error, rows) {
                    if (error)
                        return failCB(error);
                    if (numResults == null)
                        successCB(rows)
                    else if (numResults != null && rows.length == 0)
                        noneFoundCB();
                    else
                        successCB(rows);
                });
                connection.release();
            });
        },
        selectRadius: function (database, lat, lng, miles, successCB, noneFoundCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "SELECT *, ( 3959 * acos( cos( radians(?) ) * cos( radians( `lat` ) ) * cos( radians( `lng` ) - radians(?) ) + sin( radians(?) ) * sin(radians(`lat`)) ) ) AS distance FROM " + connection.escapeId(database) + "  HAVING distance < ?"
                connection.query(sql, [lat, lng, lat, miles], function (error, rows) {
                    if (error)
                        return failCB(error);
                    if (rows.length == 0)
                        noneFoundCB();
                    else
                        successCB(rows)
                });
                connection.release();
            });
        }
    },
    remove: {
        regularDelete: function (database, keys, values, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "DELETE FROM " + connection.escapeId(database) + " WHERE ";
                if (keys.length != values.length)
                    return failCB('Key length must match value length.');
                for (var index = 0; index < keys.length; index++)
                    if (index < keys.length - 1)
                        sql += "`" + keys[index] + "` = ? AND ";
                    else
                        sql += "`" + keys[index] + "` = ?";
                connection.query(sql, values, function (error, rows) {
                    if (error)
                        return failCB(error);
                    successCB(rows);
                });
                connection.release();
            });
        },
        deleteVerificationCode: function (phoneNumber, deviceId, successCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "DELETE FROM `user_verify_codes` WHERE `phone_number` = ? AND `device_id` = ?";
                connection.query(sql, [phoneNumber, deviceId], function (error, rows) {
                    if (error)
                        return failCB(error)
                });
                connection.release();
            });
        }
    },
    update: {
        updateSpotStatus(spot_id, occupied, successCB, noExistCB, failCB) {
            db.getConnection(function (err, connection) {
                var sql = "UPDATE `parking` SET `occupied` = ? WHERE `spot_id` = ?";
                connection.query(sql, [occupied, spot_id], function (error, results, fields) {
                    if (error)
                        return failCB(error);
                    if (results.affectedRows == 1)
                        successCB();
                    else
                        noExistCB();
                });
                connection.release();
            });
        },
        updateProfilePic(accessCode, deviceId, successCB, failCB) { //return profileID to use for s3 upload
            db.getConnection(function (err, connection) {
                var sql = "SELECT * FROM `user_access_codes` WHERE `access_code` = ? AND `device_id` = ?";
                connection.query(sql, [accessCode, deviceId], function (error, rows) {
                    if (error)
                        return failCB(error);
                    if (rows.length == 0) {
                        failCB('INVALID_ACCESS_CODE');
                    } else {
                        var sql = "SELECT * FROM `users` WHERE `user_id` = ?";
                        connection.query(sql, [rows[0].user_id], function (error, rows) {
                            if (error)
                                return failCB(error);
                            if (rows.length == 0) {
                                failCB('INVALID_ACCESS_CODE');
                            } else {
                                if (rows[0].profile_pic == null) {
                                    var profilePicID = uniqueString();
                                    var sql = 'UPDATE `users` SET `profile_pic` = ? WHERE `user_id` = ?';
                                    connection.query(sql, [profilePicID, rows[0].user_id], function (error, results, fields) {
                                        if (error)
                                            return failCB(error);
                                        if (results.affectedRows == 0)
                                            failCB('INVALID_ACCESS_CODE');
                                        else
                                            successCB(profilePicID);
                                    });
                                } else {
                                    successCB(rows[0].profile_pic);
                                }
                            }
                        });
                    }
                });
                connection.release();
            });
        }
    }
}