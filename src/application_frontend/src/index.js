import { identity_proxy } from "../../declarations/identity_proxy";
import { application_backend } from "../../declarations/application_backend";
import { Actor } from "@dfinity/agent";
import { IDL } from "@dfinity/candid";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { ethers } from "ethers";
import { SiweMessage } from "siwe";

const domain = window.location.host;
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const backendId = Actor.canisterIdOf(application_backend);


let cap = { msg: "", sig: "" };

// TODO: use interface to automatically get proper candid types for encoding and decoding
// const interf = Actor.interfaceOf(application_backend);
// console.log(interf);

const agent = Actor.agentOf(identity_proxy);
// Create a new identity for this session. We'll delegate capabilities to this identity
const identity = Ed25519KeyIdentity.generate();
agent.replaceIdentity(identity);

function createSiweMessage(address, statement, delegatee, resources) {
  const message = new SiweMessage({
    domain,
    address,
    statement,
    uri: delegatee,
    version: "1",
    chainId: "1",
    resources,
  });
  return message.prepareMessage();
}

function connectWallet() {
  provider
    .send("eth_requestAccounts", [])
    .catch(() => console.log("user rejected request"));
}

async function getCapability() {
  let resources = [];

  const getValue = document.getElementById("get").checked;
  const incValue = document.getElementById("inc").checked;
  const setValue = document.getElementById("set").checked;

  if (getValue) {
    resources.push("icp:" + backendId + "/get");
  }
  if (incValue) {
    resources.push("icp:" + backendId + "/inc");
  }
  if (setValue) {
    resources.push("icp:" + backendId + "/set");
  }

  const message = createSiweMessage(
    await signer.getAddress(),
    "Authorize app to access the following resources on the Internet Computer.",
    "did:icp:" + identity.getPrincipal(),
    resources
  );
  cap = {
    msg: message,
    sig: (await signer.signMessage(message)).slice(2),
  };
 
}

async function get() {
  console.log("Getting counter value...");
  let args = [...new Uint8Array(IDL.encode([], []))];
  let res = await identity_proxy.proxy_call({
    args,
    cycles: 0,
    method_name: "get",
    canister: backendId,
    siwe_msg: cap.msg,
    siwe_sig: cap.sig,
  });
  if (res.Err) {
    console.error(res.Err);
  } else {
    res = res.Ok.return;
    res = IDL.decode([IDL.Nat], res);
    console.log("Counter: " + res);
  }
}

async function inc() {
  console.log("Incrementing counter...");
  let args = [...new Uint8Array(IDL.encode([], []))];
  let res = await identity_proxy.proxy_call({
    args,
    cycles: 0,
    method_name: "inc",
    canister: backendId,
    siwe_msg: cap.msg,
    siwe_sig: cap.sig,
  });
  if (res.Err) {
    console.error(res.Err);
  } else {
    console.log("Incrementing counter successful");
  }
}

async function set() {
  console.log("Setting counter to 5");
  let args = [...new Uint8Array(IDL.encode([IDL.Nat], [5]))];

  let res = await identity_proxy.proxy_call({
    args,
    cycles: 0,
    method_name: "set",
    canister: backendId,
    siwe_msg: cap.msg,
    siwe_sig: cap.sig,
  });
  if (res.Err) {
    console.error(res.Err);
  } else {
    console.log("Setting successful");
  }
}

const connectWalletBtn = document.getElementById("connectWalletBtn");
const siweBtn = document.getElementById("siweBtn");
const getCounterBtn = document.getElementById("getCounter");
const incCounterBtn = document.getElementById("incCounter");
const setCounterBtn = document.getElementById("setCounter");
connectWalletBtn.onclick = connectWallet;
siweBtn.onclick = getCapability;
getCounterBtn.onclick = get;
incCounterBtn.onclick = inc;
setCounterBtn.onclick = set;
