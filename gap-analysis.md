# Gap Analysis

||Relay|merge-pr-to-branch|Manual|
|-|-|-|-|
|Configuration|- Centralised in Relay repo (requiring a redeployment of Relay)<br/>- add github webhook|Decentralised in each repo (github workflow)|Custom scripts run locally|
|Opt-in PR|via label|via label|- Execute manual git commands<br/>- Manually label PR|
|Opt-out PR|N/A|- removing label<br/>- PR is closed|- Execute manual git commands|
|Keeping staging clean|no mechanism for cleanup (eg. manual)|- always resets staging to master and applies each labeled, mergeable PR<br/>- reacts to master pushes to ensure staging is not out of date with master|Execute commonly shared script|
|Ownership|N/A|Prod Eng|PR creator|
|Operating/maintenance cost|Custom deployment to our AWS account|Entirely managed by Github|Relies on PR creator to remember to perform these actions|
