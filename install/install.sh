set -e

GIT_DIR=.git
WORKFLOWS_DIR=.github/workflows
WORKFLOW_FILE=merge-pr-to-branch.yml

if ! [ -d $GIT_DIR ]
then
    echo "Error: Must run this script from root of repo."
    exit 1
fi

if ! [ -d $WORKFLOWS_DIR ]
then
    echo "Creating ${WORKFLOWS_DIR} directory..."
    mkdir -p $WORKFLOWS_DIR
fi

pushd $WORKFLOWS_DIR > /dev/null

if [ -f $WORKFLOW_FILE ]
then
    echo "Error: ${WORKFLOW_FILE} already exists."
    exit 1
fi

echo "Creating ${WORKFLOW_FILE}..."
curl https://raw.githubusercontent.com/deliveroo/merge-pr-to-branch/master/install/workflow.yml -o "./${WORKFLOW_FILE}"
