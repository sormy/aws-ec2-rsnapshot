#!/usr/bin/env node

/**
 * AWS EC2 Snapshot Backup.
 *
 * Backup volume and delete outdated snapshots.
 *
 * Procedure:
 * 1) create snapshot for volume and use snapshot prefix
 * 2) find all snapshots with snapshot prefix
 * 3) delete last snapshots if retention number exceeded
 */

'use strict';

var process = require('process');
var exec = require('child_process').exec;
var util = require('util');
var moment = require('moment');

class Application {
    run() {
        if (process.argv.length == 2) {
            this.help();
            process.exit(0);
        } else if (process.argv.length != 5 && process.argv.length != 6) {
            this.help();
            process.exit(7);
        } else {
            this.execute(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
        }
    }

    help() {
        console.log('AWS EC2 Snapshot Backup');
        console.log('Usage: node aws-ec2-rsnapshot.js <snapshot-prefix> <snapshot-retention> <volume-id> [run-before]');
        console.log('Params:');
        console.log('  snapshot-prefix:    something like srv1.domain.com/daily/data');
        console.log('  snapshot-retention: number of snapshots to keep');
        console.log('  volume-id:          volume id to make snapshot from it');
        console.log('  before-command:     run command before, perfect to sync filesystem before snapshot');
        console.log('Environment variables:');
        console.log('  AWS_ACCESS_KEY_ID');
        console.log('  AWS_SECRET_ACCESS_KEY');
        console.log('  AWS_CONFIG_FILE');
        console.log('  AWS_DEFAULT_PROFILE');
        console.log('  AWS_DEFAULT_REGION');
    }

    execute(snapshotPrefix, snapshotRetention, volumeId, beforeCommand) {
        this.runBefore(this.beforeCommand, function() {
            this.createSnapshot(snapshotPrefix, volumeId, function() {
                this.listSnapshots(snapshotPrefix, function(snapshots) {
                    this.getSnapshotIdsToDelete(snapshots, snapshotRetention)
                        .forEach(function(snapshotId) {
                            this.deleteSnapshot(snapshotId);
                        }.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }

    runBefore(cmd, success) {
        if (!cmd) {
            success();
            return;
        }

        console.log('Running: ' + cmd);

        exec(cmd, function(error, stdout, stderr) {
            if (error !== null) {
                console.error('Command failed: ' + stdout + stderr);
                process.exit(1);
            } else {
                success();
            }
        });
    }

    createSnapshot(snapshotPrefix, volumeId, success) {
        var ts = moment().format('YYYY-MM-DD/HH:mm:ss');

        var cmd = util.format(
            'aws ec2 create-snapshot --volume-id %s --description %s',
            volumeId,
            snapshotPrefix + '/' + ts
        );

        console.log('Creating snapshot: ' + cmd);

        exec(cmd, function(error, stdout, stderr) {
            if (error !== null) {
                console.error('Command failed: ' + stdout + stderr);
                process.exit(2);
            } else {
                success();
            }
        });
    }

    listSnapshots(snapshotPrefix, success) {
        var cmd = util.format(
            'aws ec2 describe-snapshots --filters Name=description,Values=%s',
            snapshotPrefix + '/' + '*'
        );

        console.log('Get list of snapshots: ' + cmd);

        exec(cmd, function(error, stdout, stderr) {
            if (error !== null) {
                console.error('Command failed: ' + stdout + stderr);
                process.exit(3);
            } else {
                var data = {};

                try {
                    data = JSON.parse(stdout);
                } catch (e) {
                    console.error('Unable to parse JSON response: ' + stdout);
                    process.exit(4);
                }

                if (!data.Snapshots) {
                    console.error('Unable to find snapshot list in response: ' + stdout);
                    process.exit(5);
                }

                success(data.Snapshots);
            }
        });
    }

    getSnapshotIdsToDelete(snapshots, snapshotRetention) {
        var data = snapshots
            .sort(function(a, b) {
                // sort by StartTime ASC
                return a.StartTime == b.StartTime ? 0 : (a.StartTime > b.StartTime ? 1 : -1);
            })
            .map(function(snapshot) {
                return snapshot.SnapshotId;
            });

        if (data.length > snapshotRetention) {
            return data.slice(0, data.length - snapshotRetention);
        }

        return [];
    }

    deleteSnapshot(snapshotId) {
        var cmd = util.format(
            'aws ec2 delete-snapshot --snapshot-id %s',
            snapshotId
        );

        console.log('Deleting outdated snapshot: ' + cmd);

        exec(cmd, function(error, stdout, stderr) {
            if (error !== null) {
                console.error('Command failed: ' + stdout + stderr);
                process.exit(6);
            }
        });
    }
}

var app = new Application();
app.run();
