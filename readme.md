AWS EC2 Snapshot Backup
=======================

Installation
------------

That script could be used on both Linux and Windows instances.

For Linux you will need to install:

  - aws-cli: http://docs.aws.amazon.com/cli/latest/userguide/installing.html
  - nodejs: https://nodejs.org/en/download/

```
mkdir /srv
cd /srv
git clone https://github.com/sormy/aws-ec2-rsnapshot.git
cd aws-ec2-rsnapshot
git checkout {version}
node install
ln -s /srv/aws-ec2-rsnapshot/aws-ec2-rsnapshot.js /usr/local/bin/aws-ec2-rsnapshot
```

For Windows you will need to install:

  - aws-cli: http://docs.aws.amazon.com/cli/latest/userguide/installing.html
  - nodejs: https://nodejs.org/en/download/
  - sync (optional): https://technet.microsoft.com/en-us/sysinternals/bb897438.aspx

...

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

For example, we would like to backup root voume and store 7 daily snapshots and 8 weekly snapshots.

Here we assume that credentials and default region are stored in /root/.aws and cron tasks run from root.

File: /etc/cron.daily/aws-ec2-rsnapshot
```
#!/bin/bash

export HOME=/root
output=$(aws-ec2-rsnapshot server.com/daily/root 7 vol-12345678 sync)
if [ $? != 0 ]; then
    echo $output
fi
```

File: /etc/cron.weekly/aws-ec2-rsnapshot
```
#!/bin/bash

export HOME=/root
output=$(aws-ec2-rsnapshot server.com/weekly/root 8 vol-12345678 sync)
if [ $? != 0 ]; then
    echo $output
fi
```

Files below should have executable bit:
```
chmod +x /etc/cron.daily/aws-ec2-rsnapshot
chmod +x /etc/cron.weekly/aws-ec2-rsnapshot
```
