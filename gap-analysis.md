# Gap Analysis

||Relay|merge-pr-to-branch|
|---|---|--|
|Configuration|- Centralised in Relay repo (requiring a redeployment of Relay)<br/>- add github webhook|Decentralised in each repo (github workflow)|
|Opt-in PR|via label|via label|
|Opt-out PR|N/A|- removing label<br/>- PR is closed|
|Keeping staging clean|no mechanism for cleanup (eg. manual)|- always resets staging to master and applies each labeled, mergeable PR<br/>- reacts to master pushes to ensure staging is not out of date with master| 
|Ownership|N/A|Prod Eng|
|Operating/maintenance cost|Custom deployment to our AWS account|Entirely managed by Github|
