# Workflow Durability

## What is durable today

- `OperatorRun` + recommendations survive refresh, navigation, and process restart (DB).  
- UI can reopen `/terminal/objectives/:id`.  

## What is not fully durable yet

- Multi-hour multi-step jobs across worker death with automatic resume for all five live examples.  
- Objective execution is primarily **synchronous HTTP** + persisted result.  

## Direction

BullMQ worker already exists in monorepo for future long-running connector jobs. Margin-protection schedule should enqueue there before marking runnable.
