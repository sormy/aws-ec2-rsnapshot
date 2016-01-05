AWS EC2 Snapshot Backup
=======================

Usage
-----

```
Usage: node aws-ec2-rsnapshot.js <snapshot-prefix> <snapshot-retention> <volume-id> [run-before]
```

Params:

  - snapshot-prefix:    something like srv1.domain.com/daily/data
  - snapshot-retention: number of snapshots to keep
  - volume-id:          volume id to make snapshot from it
  - before-command:     run command before, perfect to sync filesystem before snapshot

Environment variables
---------------------

  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_CONFIG_FILE
  - AWS_DEFAULT_PROFILE
  - AWS_DEFAULT_REGION

Please look on http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html#cli-environment for more details.

Example
-------

For example, we would like to store 7 daily snapshots and 8 weekly snapshots.

Here we assume that credentials and default region are stored in ~/.aws.

File: /etc/crontab
```
...

0 0 * * * root /root/bin/asb/aws-ec2-rsnapshot.js srv1.domain.com/daily 7 vol-12345678 sync
1 0 * * 7 root /root/bin/asb/aws-ec2-rsnapshot.js srv1.domain.com/weekly 8 vol-12345678 sync
```
