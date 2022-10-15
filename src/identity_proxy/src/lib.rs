use hex::FromHex;
use siwe::{Message,VerificationOpts};
use candid::{CandidType, Principal};
use time::{OffsetDateTime};
use ic_cdk_macros::*;
use serde::Deserialize;
use std::str::{self, FromStr};

#[derive(CandidType, Deserialize)]
struct CallCanisterArgs<TCycles> {
    canister: Principal,
    method_name: String,
    #[serde(with = "serde_bytes")]
    args: Vec<u8>,
    cycles: TCycles,
}

#[derive(CandidType, Deserialize)]
struct CallCanisterArgsWithCap<TCycles> {
    canister: Principal,
    method_name: String,
    #[serde(with = "serde_bytes")]
    args: Vec<u8>,
    cycles: TCycles,
    siwe_msg: String,
    siwe_sig: String,
}

#[derive(CandidType, Deserialize)]
struct CallResult {
    #[serde(with = "serde_bytes")]
    r#return: Vec<u8>,
}

async fn validate(caller: Principal, canister: Principal, method_name: &str, siwe_msg: &str ,siwe_sig: &str) -> Result<(),String> {

    let opts = VerificationOpts {
        domain: None,
        nonce: None,
        timestamp: Some(OffsetDateTime::from_unix_timestamp((ic_cdk::api::time() / (1000 * 1000 * 1000)) as i64).unwrap())
    };
    
    let msg = Message::from_str(siwe_msg).map_err(|e| e.to_string())?;
    let sig = <[u8; 65]>::from_hex(siwe_sig).map_err(|e| e.to_string())?;
    
    // Check if uri is equal to the caller
    msg.uri.to_string().eq(&format!("did:icp:{}",&caller.to_string())).then(|| ()).ok_or("Invoked by unauthorized principal")?;
    
    // Check if target (canister and method) is part of authorized resources
    let target = format!("icp:{}/{}",canister.to_string(), method_name);
    msg.resources.clone().into_iter().find(|r| r.as_str().eq(&target)).ok_or(format!("Unauthorized for resource: {}", &target))?;

    msg.verify(&sig, &opts).await.map_err(|e| e.to_string())?;

    Ok(())

}

// Taken from cylces wallet: https://github.com/dfinity/cycles-wallet/blob/fa86dd3a65b2509ca1e0c2bb9d7d4c5be95de378/wallet/src/lib.rs#L880
#[update(name = "proxy_call")]
async fn call(
    CallCanisterArgsWithCap {
        canister,
        method_name,
        args,
        cycles,
        siwe_msg,
        siwe_sig,
    }: CallCanisterArgsWithCap<u64>,
) -> Result<CallResult, String> {
    call128(CallCanisterArgsWithCap {
        canister,
        method_name,
        args,
        cycles: cycles as u128,
        siwe_msg,
        siwe_sig,
    })
    .await
}

#[update(name = "proxy_call128")]
async fn call128(args: CallCanisterArgsWithCap<u128>) -> Result<CallResult, String> {
    if ic_cdk::api::id() == ic_cdk::caller() {
        return Err("Attempted to call forward on self. This is not allowed. Call this method via a different custodian.".to_string());
    }

    validate(ic_cdk::caller(), args.canister, &args.method_name, &args.siwe_msg, &args.siwe_sig).await?;

    match ic_cdk::api::call::call_raw128(args.canister, &args.method_name, &args.args, args.cycles).await {
        Ok(x) => Ok(CallResult { r#return: x }),
        Err((code, msg)) => Err(format!(
            "An error happened during the call: {}: {}",
            code as u8, msg
        )),
    }
}

#[update]
async fn test_call() -> String {
    String::from("It works!")
}