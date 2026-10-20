# Cosign testnet evidence (generated)

Generated from `contracts/deployments/31611.json`, `contracts/deployments/demo-run.json` and the Foundry broadcast logs. Network: Mezo testnet, chain 31611.

## Deployed contracts

| Contract | Address |
|---|---|
| Morpho Blue (our unmodified instance) | [`0xb62a0458dC292c022A05EDcc304CD3300a33DbE5`](https://explorer.test.mezo.org/address/0xb62a0458dC292c022A05EDcc304CD3300a33DbE5) |
| AdminOracle (demo only) | [`0x3040b46D1E04d3248e8D5217F65cD875cb25511c`](https://explorer.test.mezo.org/address/0x3040b46D1E04d3248e8D5217F65cD875cb25511c) |
| CosignGauge | [`0x2CFd9144D4789FF20c0996e8AB3035cAC2f4825c`](https://explorer.test.mezo.org/address/0x2CFd9144D4789FF20c0996e8AB3035cAC2f4825c) |
| FixedRateIrm, Bold (12% APR) | [`0x50C1fECCF04E85Fae4eb02b29309201F1B5e2085`](https://explorer.test.mezo.org/address/0x50C1fECCF04E85Fae4eb02b29309201F1B5e2085) |
| CosignVault, Bold (77% LLTV, min cover 5%) | [`0xE63760ef37aCb3582fc3E54CB4091a421BFf092b`](https://explorer.test.mezo.org/address/0xE63760ef37aCb3582fc3E54CB4091a421BFf092b) |
| FixedRateIrm, Steady (8% APR) | [`0x816dbB41CfD0371B7a68a86b99BD84b9252137d4`](https://explorer.test.mezo.org/address/0x816dbB41CfD0371B7a68a86b99BD84b9252137d4) |
| CosignVault, Steady (62.5% LLTV, min cover 10%) | [`0xb027B495A82376dBef620DFb901DC392D75A6cdD`](https://explorer.test.mezo.org/address/0xb027B495A82376dBef620DFb901DC392D75A6cdD) |
| CosignLiquidator | [`0xF07C60aA6DE6066fCF92fA41EfAde13ff97415b1`](https://explorer.test.mezo.org/address/0xF07C60aA6DE6066fCF92fA41EfAde13ff97415b1) |
| MUSD (Mezo) | [`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) |
| MEZO (Mezo precompile) | [`0x7B7c000000000000000000000000000000000001`](https://explorer.test.mezo.org/address/0x7B7c000000000000000000000000000000000001) |
| veBTC (Mezo) | [`0xB63fcCd03521Cf21907627bd7fA465C129479231`](https://explorer.test.mezo.org/address/0xB63fcCd03521Cf21907627bd7fA465C129479231) |

## Deployment transactions

| Step | Transaction |
|---|---|
| core: Morpho create | [`0xe492b43e1397e4c3…`](https://explorer.test.mezo.org/tx/0xe492b43e1397e4c338594ea356aa3fc051703cf18ba269892faaf0b90cad4efd) |
| core: AdminOracle create | [`0x0d6e895a3d42aa99…`](https://explorer.test.mezo.org/tx/0x0d6e895a3d42aa9973406562a230a5db0150abff6f81959becd6b28e98448607) |
| core: CosignGauge create | [`0xfa2442afa6aa6efc…`](https://explorer.test.mezo.org/tx/0xfa2442afa6aa6efcd8c66ac6c7803b80bcdbb898b49a3907e5be47beaeac6b0f) |
| core: FixedRateIrm create | [`0x135b44e9b43ad546…`](https://explorer.test.mezo.org/tx/0x135b44e9b43ad546b7b4f0b08fe5c9409bfc045b210d9d19f22d0efd39f0cef8) |
| core: Morpho enableIrm(address) | [`0xa968d82026688e1e…`](https://explorer.test.mezo.org/tx/0xa968d82026688e1e50fd35efed19546a3c131f80a1ba53eaa1dd72a980e77904) |
| core: Morpho enableLltv(uint256) | [`0x9a7b707c7523d073…`](https://explorer.test.mezo.org/tx/0x9a7b707c7523d073cb0b64a723c5980fee868c87f89a1cdb02c110c398e355b7) |
| core: Morpho createMarket((address,address,address,address,uint256)) | [`0xfcbaef3dc5013414…`](https://explorer.test.mezo.org/tx/0xfcbaef3dc5013414272dc025b9ff43f303db106b4717736cf52fdc1aa45ae2d8) |
| core: CosignVault create | [`0xc7aadab0e8d7e5c2…`](https://explorer.test.mezo.org/tx/0xc7aadab0e8d7e5c27c4a79a8dc97928c57ed813f47e12e6076190dbb25d99f09) |
| core: CosignVault setGauge(address) | [`0xd0ac373c112dbcd7…`](https://explorer.test.mezo.org/tx/0xd0ac373c112dbcd70be1b92963a932d27080ea00c9b90559d7533c1101b18fb4) |
| core: CosignGauge addVault(address,uint256) | [`0x8ca22e968817b3c9…`](https://explorer.test.mezo.org/tx/0x8ca22e968817b3c916d631a646ed4033375162883c02c462e5a7e8f2b45acdf0) |
| Steady market: FixedRateIrm create | [`0x8a684777c1d97bb3…`](https://explorer.test.mezo.org/tx/0x8a684777c1d97bb32f3e1b54a6f7b1102a2d1cc7a0cb3b488b32b7f1959cd0ae) |
| Steady market: enableIrm(address) | [`0x35bd775f3a86a716…`](https://explorer.test.mezo.org/tx/0x35bd775f3a86a7163b1c23576a9f88926fce96dacb6705c38199db524c54edca) |
| Steady market: enableLltv(uint256) | [`0xeb09b274fbf063b4…`](https://explorer.test.mezo.org/tx/0xeb09b274fbf063b49047001cf7231a79e136341ce7b57c6ca1cb6593f3ad790f) |
| Steady market: createMarket((address,address,address,address,uint256)) | [`0xb59bbeaa78207d45…`](https://explorer.test.mezo.org/tx/0xb59bbeaa78207d45a66e3b465ad9da0b6a0522c09c680540dee562cfda90eb91) |
| Steady market: CosignVault create | [`0x1bf46978d1db6571…`](https://explorer.test.mezo.org/tx/0x1bf46978d1db6571c3d57900660a954fed825bfcd5372056f4d7f556b1cf7711) |
| Steady market: CosignVault setGauge(address) | [`0x0275b38adff08f34…`](https://explorer.test.mezo.org/tx/0x0275b38adff08f34d0b6d86acedfae3b9d2bd525a20869afbf205ea5d74e443f) |
| Steady market: addVault(address,uint256) | [`0x65aa67441a7fec6e…`](https://explorer.test.mezo.org/tx/0x65aa67441a7fec6ed680a4f984e9324ff386eb61331a90c0e60c4856e4ba456d) |
| CosignLiquidator create | [`0xef63d5c969eb14a1…`](https://explorer.test.mezo.org/tx/0xef63d5c969eb14a160fd9ab3b3cfb30a155a4d8858f3da340f5bee6f8645dece) |

## Every demo transaction

| # | Step | Actor | Block | Transaction |
|---|---|---|---|---|
| 1 | Deployer borrows 2350 MUSD from Mezo (openTrove) | deployer | 16260452 | [`0x18b26ba2ef669f0d…`](https://explorer.test.mezo.org/tx/0x18b26ba2ef669f0d43ceeee6cc9126856b11684c6dcf3c78b05da4a8d5c53c35) |
| 2 | Fund cosigner with BTC for gas | deployer | 16260453 | [`0x82e0b92fb46993ba…`](https://explorer.test.mezo.org/tx/0x82e0b92fb46993bad4f185b27011c906a84c1ab4c3161ee6a1b843c454ca3416) |
| 3 | Fund lender with BTC for gas | deployer | 16260454 | [`0xef278538a7d2649a…`](https://explorer.test.mezo.org/tx/0xef278538a7d2649afd345aa1d63525f2b1d718212f5a7d9a6067b5def1d1f238) |
| 4 | Fund borrower with BTC for gas | deployer | 16260455 | [`0xee6395cde0d3c0d5…`](https://explorer.test.mezo.org/tx/0xee6395cde0d3c0d5204190319ffc4d851da19d49dd31da418c4aec367da14018) |
| 5 | Fund co-signer with MUSD | deployer | 16260456 | [`0x5dc7629cdb40325b…`](https://explorer.test.mezo.org/tx/0x5dc7629cdb40325b9bf5c6430cfb091f909e3509feb54126da61908f95adb956) |
| 6 | Fund lender with MUSD | deployer | 16260457 | [`0xfbb34139d59ec370…`](https://explorer.test.mezo.org/tx/0xfbb34139d59ec37098495beed6816c833d60021332f2640abcf314089c08093e) |
| 7 | Fund borrower with 91.4286 MEZO collateral | deployer | 16260459 | [`0xcee3d16df796e1a2…`](https://explorer.test.mezo.org/tx/0xcee3d16df796e1a2193a56d6e48a8877747864a9fab015ae026a4c5cfffb7d8d) |
| 8 | Co-signer approves BTC for veBTC | cosigner | 16260461 | [`0xa0a4e8c706b726e0…`](https://explorer.test.mezo.org/tx/0xa0a4e8c706b726e076c8be78f0b391e1959709f7e6d52ae30e74654d28312caf) |
| 9 | Co-signer locks 0.001 BTC in Mezo veBTC for 4 weeks | cosigner | 16260464 | [`0xe80fd08939c445c2…`](https://explorer.test.mezo.org/tx/0xe80fd08939c445c2b556f2224279b64bfb5b83553c3ceabfc6d2e96d86ceefd4) |
| 10 | Co-signer approves MUSD for Bold vault | cosigner | 16260466 | [`0xc72c85654cdc89a7…`](https://explorer.test.mezo.org/tx/0xc72c85654cdc89a7e1d1982488eeda2496bb63f183eb127eaac118c1692df1da) |
| 11 | Co-signer posts 10.0000 MUSD cover (Bold) | cosigner | 16260467 | [`0xab1cd7a40bf51b70…`](https://explorer.test.mezo.org/tx/0xab1cd7a40bf51b704f30fd09e3b0def6eb12d0dfa4151e8167d3885d0ab606d4) |
| 12 | Co-signer votes veBTC 100% for Bold | cosigner | 16260469 | [`0xf39914f93cae27e0…`](https://explorer.test.mezo.org/tx/0xf39914f93cae27e0d6ebee9ea8a0e0babd496303738490dbd0c865609756d846) |
| 13 | Co-signer posts 390.0000 more MUSD cover (Bold) | cosigner | 16260471 | [`0x2239c62e9859202f…`](https://explorer.test.mezo.org/tx/0x2239c62e9859202f8d3e9b3014161ba1d62dc235fdd809c14cb73208e9287b17) |
| 14 | Lender approves MUSD for Bold vault | lender | 16260474 | [`0x51a03c49256857e6…`](https://explorer.test.mezo.org/tx/0x51a03c49256857e60cf2e615570999db63cae7f4b201cfe89b2b82337855c473) |
| 15 | Lender deposits 1000 MUSD (Bold, senior) | lender | 16260476 | [`0x6730a330afdd5a2d…`](https://explorer.test.mezo.org/tx/0x6730a330afdd5a2dc727737914defbb20e2215e9e3aaa94f28b0a83fb12d2be5) |
| 16 | Deployer approves MEZO for gauge (manual retry after RPC error) | deployer | 16260485 | [`0x97390ab3b9ecc212…`](https://explorer.test.mezo.org/tx/0x97390ab3b9ecc212b7706943ea477481fc505e708a938c72487afd09d348ca72) |
| 17 | Deployer approves MEZO for gauge | deployer | 16260492 | [`0x4089c407a3051fa3…`](https://explorer.test.mezo.org/tx/0x4089c407a3051fa31dff2d984b17c59bd9b4cd8ca68fd15da3948dc789fa1498) |
| 18 | Deployer funds 8 MEZO rewards (self-funded) | deployer | 16260494 | [`0x3cec3c1d08e1c025…`](https://explorer.test.mezo.org/tx/0x3cec3c1d08e1c0256850558193a75daa2862406820bcb2b85a8c352160c578f8) |
| 19 | Borrower approves MEZO for Morpho | borrower | 16260505 | [`0x074cceb0fb4f3e3d…`](https://explorer.test.mezo.org/tx/0x074cceb0fb4f3e3ddfeb8e465826284f4cf2a6c289443198260297a5d1f98bff) |
| 20 | Borrower approves MEZO for Morpho | borrower | 16260519 | [`0x2ac05679228cd21a…`](https://explorer.test.mezo.org/tx/0x2ac05679228cd21a5cf6f35eb3d0d2bbae75b0253e48061fb8a54111032151cf) |
| 21 | Borrower posts 71.4286 MEZO collateral (Bold) | borrower | 16260521 | [`0xa7df0c16894aacea…`](https://explorer.test.mezo.org/tx/0xa7df0c16894aaceae66e66c78f76ec07f3d94e6c7fed0a9d20f7561b85ca538a) |
| 22 | Borrower borrows 500 MUSD at 70% LTV (Bold) | borrower | 16260523 | [`0xe192d8d96f46b8b4…`](https://explorer.test.mezo.org/tx/0xe192d8d96f46b8b4c5e15ab044adb94989ee869eecb64a168972bfd16162620b) |
| 23 | DEMO ORACLE: MEZO price -70% (10.00 -> 3.00 MUSD) | deployer | 16260528 | [`0x4d10d211329d4d23…`](https://explorer.test.mezo.org/tx/0x4d10d211329d4d2310bbbcfd480b1ddddfee39abd1593922e672f82409fde73b) |
| 24 | Liquidator approves MUSD for Morpho | deployer | 16260530 | [`0xb1282b0b927c7288…`](https://explorer.test.mezo.org/tx/0xb1282b0b927c72885b3562e9e2d6135462d4ec98e0ebb21b4cdcfb01f2e18569) |
| 25 | Liquidator seizes all collateral; Morpho realises bad debt | deployer | 16260533 | [`0x2493df18ac5a416b…`](https://explorer.test.mezo.org/tx/0x2493df18ac5a416b44205bfa4d0c343225a7ac9746d984334a5452105de10b6a) |
| 26 | Cosign sync: loss charged to cover first | deployer | 16260536 | [`0xc884e956e06303b4…`](https://explorer.test.mezo.org/tx/0xc884e956e06303b477add9a8c4c0b10e62d12fd707cc26b8897b26dfc83d3465) |
| 27 | Gauge distributes epoch 0 MEZO by cover-capped weight | deployer | 16260565 | [`0x3abab68ae1592934…`](https://explorer.test.mezo.org/tx/0x3abab68ae159293458b9e0cff26990958ecc0b092330593d3369817c4cb6ab9a) |
| 28 | Cosigner claims MEZO rewards (Bold) | cosigner | 16260594 | [`0x521992de7750cecd…`](https://explorer.test.mezo.org/tx/0x521992de7750cecd8345fed9ffa4323a31754b814e7acd9d272c6583b2ac086e) |
| 29 | Cosigner claims MEZO rewards (Bold) | cosigner | 16260697 | [`0xd1feeca0d676590a…`](https://explorer.test.mezo.org/tx/0xd1feeca0d676590aa8ad2fef7ae4507e83b03eb3e2d14e87249333c873545e3f) |
| 30 | Lender claims MEZO rewards (Bold) | lender | 16260699 | [`0xf760d6006bdf4196…`](https://explorer.test.mezo.org/tx/0xf760d6006bdf4196061ce182e34278183ad2d4590cdbaf22fe135a052ff6e978) |
| 31 | DEMO ORACLE: restore starting MEZO price | deployer | 16260707 | [`0x8470891e9b9459f7…`](https://explorer.test.mezo.org/tx/0x8470891e9b9459f75a7c0c2311e88833451ca4471c181192b0d3e384f4e264fc) |
| 32 | Fund borrower with 14.2857 MEZO (second Bold loan) | deployer | 16260709 | [`0x8cd16500a49eeccc…`](https://explorer.test.mezo.org/tx/0x8cd16500a49eeccc10aa4476fc995a99dad3f87f0facfbaddb428b7440c66ed8) |
| 33 | Borrower approves MEZO for Morpho | borrower | 16260712 | [`0xf7cc531095c1e89c…`](https://explorer.test.mezo.org/tx/0xf7cc531095c1e89c3654a6339c04598a00b3d15eed2fc421d6ca0793aa6a086e) |
| 34 | Borrower posts 14.2857 MEZO collateral (Bold, loan 2) | borrower | 16260714 | [`0xc8c7044abb6aa6e9…`](https://explorer.test.mezo.org/tx/0xc8c7044abb6aa6e9d3ff33194918e11b81258e601df237eeea926230ed165715) |
| 35 | Borrower borrows 100 MUSD (Bold, loan 2) | borrower | 16260716 | [`0x6ba66d9c9a93a798…`](https://explorer.test.mezo.org/tx/0x6ba66d9c9a93a798a9281c797b998f4658b7d0afadd7f97047c241be46f068aa) |
| 36 | DEMO ORACLE: MEZO price -70% (10.00 -> 3.00 MUSD) | deployer | 16260756 | [`0xddf36958e60d451a…`](https://explorer.test.mezo.org/tx/0xddf36958e60d451a621255db10d2f9fecb3accdc88e91b240ea04b36c00690c6) |
| 37 | Liquidator approves MUSD for CosignLiquidator | deployer | 16260758 | [`0x1fa2a97337455fac…`](https://explorer.test.mezo.org/tx/0x1fa2a97337455fac09987c75ff7686ce6860390c3880bb39ab390b919845dc74) |
| 38 | CosignLiquidator: sync, liquidate on Morpho, sync | deployer | 16260760 | [`0x9e42ce86822aab81…`](https://explorer.test.mezo.org/tx/0x9e42ce86822aab81d363ab7d26ffe1120bbb85170df6a039c9034ac1ac935679) |
| 39 | DEMO ORACLE: restore starting MEZO price | deployer | 16260765 | [`0x7eca4115ba992203…`](https://explorer.test.mezo.org/tx/0x7eca4115ba9922038a669d600c976ad274cd6639e3bbefde1568b72124f4a07d) |
| 40 | Deployer borrows 300 more MUSD from Mezo (withdrawMUSD) | deployer | 16260793 | [`0xd7de26acdcaea2eb…`](https://explorer.test.mezo.org/tx/0xd7de26acdcaea2ebf90ff07abf5ce95c2cda25e8cd511f0e77fc2c742e9c5aba) |
| 41 | Fund co-signer with 60 MUSD for the browser recap test | deployer | 16260811 | [`0xd664536a0aa71c9c…`](https://explorer.test.mezo.org/tx/0xd664536a0aa71c9cbb6d7cffe303b7504542fddf290e25b5cf6e191a6c6e4555) |
| 42 | Deployer approves MEZO for gauge | deployer | 16260857 | [`0x8f62fc021f70b626…`](https://explorer.test.mezo.org/tx/0x8f62fc021f70b6269a29f0aa8dd35bc16be1ed9db180b92db2f37c724946b945) |
| 43 | Deployer funds 10 MEZO rewards (self-funded, two markets) | deployer | 16260859 | [`0x25ac3e96d1d71501…`](https://explorer.test.mezo.org/tx/0x25ac3e96d1d715019bd58bd8d977a07b3c62beb867ce179efbe3f6455314b2ea) |
| 44 | Gauge distributes epoch 3 MEZO across both markets | deployer | 16260905 | [`0x598ff367778f0d08…`](https://explorer.test.mezo.org/tx/0x598ff367778f0d08958282610fd70e9b35d8a0d163623d24eaee0c7af2c1e75d) |
| 45 | Co-signer requests to withdraw 10% of Steady cover | cosigner | 16260972 | [`0x68aa620fc59ffd96…`](https://explorer.test.mezo.org/tx/0x68aa620fc59ffd96394bf968909b5729102e7d02cd7c552d3ade913e286e8663) |

## Every recorded check

| # | Result | Check | Detail |
|---|---|---|---|
| 1 | PASS | Trove collateral ratio is safe | 148.3% with 0.0465 BTC at $81,413 (min 110%) |
| 2 | PASS | MUSD received from Mezo borrowing | 2,350.0000 MUSD |
| 3 | PASS | veBTC position minted to co-signer | tokenId 390, voting power 0.0008 |
| 4 | PASS | Junior shares and cover recorded | 10000000000000000000000000 shares worth 10.0000 MUSD |
| 5 | PASS | Effective weight capped by cover | votes 752559413315346, cover cap 100000000000000 (10.0000 MUSD x capRate 10000000000000), effective 100000000000000 |
| 6 | PASS | Effective weight follows cover live | cover cap now 4000000000000000, effective 752559413315346 (was 100000000000000) |
| 7 | PASS | Lending capacity opened by cover | 7,600.0000 MUSD (= 400 cover x 19) |
| 8 | PASS | Deposit above capacity is rejected | eth_call depositSenior(7,600.0000) -> reverted data: "0xac235bb400000000000000000000000000000000000000000000019bff2ff57968c00000" |
| 9 | PASS | Senior and junior capital allocated | senior 1,000.0000, junior 400.0000, coverage 28.57% |
| 10 | PASS | Vault supplied everything to Morpho | Morpho market supply 1,400.0000 MUSD |
| 11 | PASS | Gauge holds exactly the funded MEZO | epoch 0 budget 8.0000 MEZO |
| 12 | PASS | Collateral and debt recorded by Morpho | collateral 71.4286 MEZO, debt 500.0000 MUSD, LTV 70.00% (LLTV 77%) |
| 13 | PASS | Borrower received MUSD | 500.0000 MUSD |
| 14 | PASS | Only the oracle owner can set the demo price | eth_call setPrice from borrower -> reverted data: "0x118cdaa7000000000000000000000000a93a62aab9aafb581d1a5340cfe51ddaa405917f" |
| 15 | PASS | Borrower is now liquidatable | LTV 233.3% > LLTV 77% |
| 16 | PASS | Morpho realised bad debt | 300.5000 MUSD written off market supply (approx., includes accrued interest delta) |
| 17 | PASS | LossAbsorbed: juniorLoss + seniorLoss == recognized loss | 300.5000 + 0.0000 = 300.5000 MUSD (tx 0xc884e956e06303b477add9a8c4c0b10e62d12fd707cc26b8897b26dfc83d3465) |
| 18 | PASS | Junior absorbed the whole loss | cover 400.0000 -> 99.5000 MUSD (+ interest accrued before sync) |
| 19 | FAIL | Senior book not reduced by the loss | senior 1,000.0000 -> 1,000.0000 MUSD **Note:** Real finding: senior had 0.0000153 MUSD of interest accrued but not yet synced; a same-interval liquidation netted it against the loss. Fixed with CosignLiquidator (sync, liquidate, sync); verified live in the second loss below. |
| 20 | PASS | Distributed no more than funded | funded 8.0000, sent to Bold 8.0000, left in gauge 0.0000 |
| 21 | PASS | Epoch cannot be distributed twice | second distribute -> reverted data: "0xcce553a9" |
| 22 | PASS | Cosigner claim paid | 0.5680 MEZO |
| 23 | FAIL | Cosigner cannot double claim | pending right after claim 0.0280 MEZO (only new streaming) **Note:** Check bug, not a contract bug: rewards kept streaming in the seconds between the claim and the check. Re-checked after the stream ended: pending 0, second claim pays 0. |
| 24 | PASS | Cosigner has nothing left to claim after the stream | pending 0 |
| 25 | PASS | Cosigner second claim pays 0 | eth_call claimRewards -> 0 |
| 26 | PASS | Lender has nothing left to claim after the stream | pending 0 |
| 27 | PASS | Lender second claim pays 0 | eth_call claimRewards -> 0 |
| 28 | PASS | Claims + vault remainder == distributed (no over-distribution) | claimed 8.0000 + left in vault 0.0000 (rounding dust) = 8.0000 of 8.0000 MEZO |
| 29 | PASS | Senior has unbooked interest before the crash | booked 1,000.0000, with pending interest 1000.000047499814 MUSD |
| 30 | PASS | Interest booked before the loss (InterestAccrued precedes LossAbsorbed) | senior credited 0.000055286672 MUSD interest first |
| 31 | PASS | Second loss: juniorLoss + seniorLoss == recognized loss | 60.1001 + 0.0000 = 60.1001 MUSD |
| 32 | PASS | Senior kept all interest earned before the loss | senior 1,000.0000 -> 1000.000055286672 MUSD |
| 33 | PASS | Coverage below minimum after the real loss | coverage 3.79% < 5%, room to lend 0 |
| 34 | PASS | Lender deposits blocked while under-covered | eth_call depositSenior(1) -> reverted data: "0xac235bb40000000000000000000000000000000000000000000000000000000000000000" |
| 35 | PASS | Top-up received | deployer holds 360.6000 MUSD |
| 36 | PASS | Two-market split follows effective weight | weights {'Bold': 451112268359727, 'Steady': 300741512239818}, sent Bold 6.0000 / Steady 4.0000 of 10 MEZO |
| 37 | PASS | Withdrawal request recorded with a notice period | ready at 1792493975 (594s from now), 15000000000000000000000000 shares |
| 38 | PASS | Cover cannot be withdrawn before the notice period ends | eth_call withdrawJunior -> reverted data: "0x5a8f69d5000000000000000000000000000000000000000000000000000000006ad74997" |
| 39 | PASS | Accounts without a request cannot withdraw cover | eth_call withdrawJunior from lender -> reverted data: "0xcffd93ac" |
