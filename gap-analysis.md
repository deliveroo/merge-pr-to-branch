# Gap Analysis

||Relay|merge-pr-to-branch|
|---|---|--|
|Configuration|Centralised in Relay repo (requiring redeploying Relay)|Decentralised in each repo|
|Opt-in PR|via label|via label|
|Opt-out PR|N/A|- removing label<br/>- PR is unmergeable<br/>- PR is completed|
|Keeping staging clean|no mechanism for cleanup (eg. manual)|- always resets staging to master and applies each labeled, mergeable PR<br/>- reacts to master pushes to ensure staging is not out of date with master| 
|Ownership|N/A|Prod Eng|