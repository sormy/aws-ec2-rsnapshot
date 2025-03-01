#!/bin/sh

# AWS EC2 Snapshot Backup
# Backup volume and delete outdated snapshots.
#
# Usage: ./aws-ec2-rsnapshot.sh <snapshot-prefix> <snapshot-retention> <volume-id|device-path> [run-before]
#
# Environment variables:
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_CONFIG_FILE
#   AWS_DEFAULT_PROFILE
#   AWS_DEFAULT_REGION

set -e

help() {
    echo "AWS EC2 Snapshot Backup"
    echo "Usage: $0 <snapshot-prefix> <snapshot-retention> <volume-id|device-path> [run-before]"
    echo "Params:"
    echo "  snapshot-prefix:       something like srv1.domain.com/daily/data"
    echo "  snapshot-retention:    number of snapshots to keep"
    echo "  volume-id|device-path: volume id or local device path (e.g., /dev/nvme0n1p1)"
    echo "  before-command:        run command before, perfect to sync filesystem before snapshot"
    exit 0
}

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
    help
fi

SNAPSHOT_PREFIX="$1"
SNAPSHOT_RETENTION="$2"
VOLUME_ID_OR_PATH="$3"
BEFORE_COMMAND="$4"

INSTANCE_ID=""
VOLUME_ID=""

resolve_instance_id() {
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    if [ -z "$INSTANCE_ID" ]; then
        IMDS2_TOKEN=$(curl -s -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" \
                           -X PUT "http://169.254.169.254/latest/api/token")
        INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $IMDS2_TOKEN" \
                           http://169.254.169.254/latest/meta-data/instance-id)
    fi
    
    if [ -z "$INSTANCE_ID" ]; then
        echo "Failed to lookup instance ID"
        exit 1
    fi
}

resolve_volume_id() {
    case "$VOLUME_ID_OR_PATH" in 
        /dev/*)
            echo "Resolving volume ID for device: $VOLUME_ID_OR_PATH"
            resolve_instance_id
            VOLUME_ID=$(aws ec2 describe-instances \
                        --instance-id "$INSTANCE_ID" \
                        --query 'Reservations[*].Instances[*].BlockDeviceMappings[?DeviceName==`'"$VOLUME_ID_OR_PATH"'`].Ebs.VolumeId' \
                        --output text)
            if [ -z "$VOLUME_ID" ]; then
                echo "Failed to resolve volume ID for device: $VOLUME_ID_OR_PATH"
                exit 1
            fi
            echo "Resolved volume ID: $VOLUME_ID"
            ;;
        *)
            VOLUME_ID="$VOLUME_ID_OR_PATH"
            echo "Using volume ID: $VOLUME_ID"
            ;;
    esac
}

run_before() {
    if [ -n "$BEFORE_COMMAND" ]; then
        echo "Running: $BEFORE_COMMAND"
        sh -c "$BEFORE_COMMAND"
    fi
}

create_snapshot() {
    TIMESTAMP=$(date +"%Y-%m-%d/%H:%M:%S")
    SNAPSHOT_DESC="$SNAPSHOT_PREFIX/$TIMESTAMP"
    echo "Creating snapshot: $SNAPSHOT_DESC"
    aws ec2 create-snapshot --volume-id "$VOLUME_ID" --description "$SNAPSHOT_DESC"
}

list_snapshots() {
    echo "Getting list of snapshots for prefix: $SNAPSHOT_PREFIX"
    aws ec2 describe-snapshots \
        --filters "Name=description,Values=$SNAPSHOT_PREFIX/*" \
        --query 'Snapshots[*].[SnapshotId,StartTime]' \
        --output text
}

get_snapshots_to_delete() {
    list_snapshots | sort -k2 | awk '{print $1}' | head -n -$SNAPSHOT_RETENTION
}

delete_snapshot() {
    SNAPSHOT_ID="$1"
    if [ -n "$SNAPSHOT_ID" ]; then
        echo "Deleting outdated snapshot: $SNAPSHOT_ID"
        aws ec2 delete-snapshot --snapshot-id "$SNAPSHOT_ID"
    fi
}

delete_snapshots() {
    for SNAPSHOT_ID in $(get_snapshots_to_delete); do
        delete_snapshot "$SNAPSHOT_ID"
    done
}

resolve_volume_id
run_before
create_snapshot
delete_snapshots
