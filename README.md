# Sign-in with Ethereum / CACAO AuthZ on the Internet Computer

This is a Proof of Concept of an identity proxy (or a very simple version of a smart wallet) canister that validates signed [SIWE](https://eips.ethereum.org/EIPS/eip-4361) messages. This allows dApps on the IC to use e.g. MetaMask for authentication, and authorization via fine-grained access control by specifying the allowed target canisters and methods.

## How does it work?

The application generates a new short-lived (EdDSA) identity and asks an Ethereum wallet (e.g. MetaMask) for certain capabilities, denoted as canister ID-method pairs as `icp:<canisterId>/method`. The capability can only be invoked by this short-lived EdDSA identity, i.e it's a bound bearer token.

The user can see the authorization request in her wallet and approve it by signing it. The message/signature pair acts as a capability.

Now, when the application, i.e. the agent wants to make a call to a certain target canister, it instead makes a call to the identity proxy canister's

```
proxy_call: (record {
        canister: principal; // the principal of the target canister
        method_name: text; // the method on the target canister
        args: blob; // the arguments of the call
        cycles: nat64; // can be used to send cycles from your identity proxy to the target canister
        siwe_msg: text; // the SIWE msg
        siwe_sig: text; // the cryptographic signature over the SIWE msg.
    }) -> (ProxyResultCall);
```

The proxy canister will validate the SIWE capability and if the caller is authorized to perform the call, the proxy canister will make the call to the target canister and return the respective result.

This also means, that the target canister only sees the identity of the proxy canister, and every Ethereum address should have its own identity proxy canister. We could think of a management canister that an agent would consult to get the principal of an identity proxy canister corresponding to a particular Ethereum address, and to create a new identity proxy canister if doesn't exist yet.

## Live deployment

Simple toy application based on the Motoko counter example:

https://x2fba-byaaa-aaaak-qawpa-cai.ic0.app

Open the JavaScript console otherwise there's not much to see.

## Remarks

- Ideally, we don't want that every call needs to go through the identity proxy because it adds latency and costs, but then the target  canister or system would need to check the capabilites.
- It would be nice if it would be possible to inject an identity proxy in agent-js, such that the agent would automatically call the proxy canister instead of the actual target canister.
- I had to patch [siwe-rs](https://github.com/spruceid/siwe-rs), because it used the `std` feature of the `k256` crate which activates the optional `getrandom` crate that is not compatible with the `wasm32-unkown-unknown` build target.

