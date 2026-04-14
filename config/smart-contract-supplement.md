# Smart Contract Supplement — AGENTS.md Extension

Automatically loaded when smart contract files are detected in the project.

## Solidity Conventions

- Use Solidity 0.8.x+ (built-in overflow checks)
- Use `custom errors` over `require(condition, "string")` — cheaper gas
- Use `immutable` for constructor-set variables, `constant` for compile-time constants
- Events for every state change. Off-chain indexers depend on them.
- NatSpec comments on all public/external functions

## Security Patterns

### Checks-Effects-Interactions (CEI)
Always: validate inputs → update state → make external calls. Never call external contracts before updating your own state.

### Access Control
- Use OpenZeppelin's `AccessControl` or `Ownable2Step` (not `Ownable`)
- `Ownable2Step` prevents transferring ownership to wrong address
- Map every function to its required role. Document in access control matrix.

### Reentrancy
- Use `ReentrancyGuard` on all functions that make external calls
- Even with CEI, add the guard as defense in depth
- Watch for cross-function reentrancy (function A calls external, reenter through function B)

### Integer Safety
- Solidity 0.8+ has overflow protection by default
- `unchecked` blocks bypass this — only use for gas optimization with proven safety
- Division truncates toward zero. Multiply before dividing to preserve precision.
- Use `mulDiv` from OpenZeppelin for precision-sensitive calculations.

### Oracle Safety
- Never use spot prices. Use TWAP (time-weighted average price).
- Check oracle staleness: `require(block.timestamp - updatedAt < MAX_STALENESS)`
- Check for zero/negative prices
- Chainlink: check `answeredInRound >= roundId`

## Foundry Testing Patterns

- Use `forge test -vvv` for verbose output on failures
- `vm.prank(address)` to test as different callers
- `vm.expectRevert(...)` to test error cases
- `vm.warp(timestamp)` for time-dependent tests
- Fuzz testing: `function testFuzz_X(uint256 amount) public` — Foundry generates random inputs
- Invariant testing for stateful properties that must always hold

## Common Gotchas

- `msg.sender` in constructor is deployer, not proxy. Use initializers for upgradeable contracts.
- `delegatecall` preserves `msg.sender` and `msg.value` from the original call
- `selfdestruct` is deprecated in newer EVM versions
- `block.timestamp` can be manipulated by miners (±15 seconds)
- Storage slots in proxies: use EIP-1967 storage slots to avoid collisions
- ERC20 `approve` race condition: use `increaseAllowance`/`decreaseAllowance` or set to 0 first
