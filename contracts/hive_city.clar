;; HiveCity - Decentralized Urban Planning Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-owner (err u101))
(define-constant err-invalid-coordinates (err u102))
(define-constant err-parcel-exists (err u103))
(define-constant err-invalid-proposal (err u104))
(define-constant err-insufficient-stake (err u105))
(define-constant min-stake-amount u100)
(define-constant reward-rate u5)

;; Data Variables
(define-data-var next-parcel-id uint u0)
(define-data-var next-proposal-id uint u0)
(define-data-var total-staked uint u0)

;; Data Maps
(define-map land-parcels
    uint
    {
        owner: principal,
        coordinates: (tuple (x uint) (y uint)),
        zone-type: (string-ascii 20),
        structures: (list 10 uint)
    }
)

(define-map structures
    uint 
    {
        owner: principal,
        structure-type: (string-ascii 20),
        attributes: (list 5 uint)
    }
)

(define-map proposals
    uint 
    {
        proposer: principal,
        parcel-id: uint,
        proposed-zone: (string-ascii 20),
        votes-for: uint,
        votes-against: uint,
        status: (string-ascii 10),
        end-block: uint
    }
)

(define-map staking-positions
    principal
    {
        amount: uint,
        rewards: uint,
        last-claim: uint
    }
)

;; NFT Definitions
(define-non-fungible-token land-parcel uint)
(define-non-fungible-token structure uint)

;; Staking Functions
(define-public (stake (amount uint))
    (let
        ((current-stake (default-to {amount: u0, rewards: u0, last-claim: block-height}
                        (map-get? staking-positions tx-sender))))
        (if (>= amount min-stake-amount)
            (begin
                (map-set staking-positions tx-sender
                    (merge current-stake {
                        amount: (+ (get amount current-stake) amount),
                        last-claim: block-height
                    }))
                (var-set total-staked (+ (var-get total-staked) amount))
                (ok true))
            err-insufficient-stake)
    )
)

(define-public (claim-rewards)
    (let
        ((position (unwrap! (map-get? staking-positions tx-sender) (err u0)))
         (blocks-staked (- block-height (get last-claim position)))
         (reward-amount (* blocks-staked reward-rate)))
        (begin
            (map-set staking-positions tx-sender
                (merge position {
                    rewards: u0,
                    last-claim: block-height
                }))
            (ok reward-amount))
    )
)

;; Land Parcel Functions
(define-public (mint-land-parcel (x uint) (y uint) (zone (string-ascii 20)))
    (let
        ((parcel-id (var-get next-parcel-id)))
        (if (is-eq tx-sender contract-owner)
            (begin
                (try! (nft-mint? land-parcel parcel-id tx-sender))
                (map-set land-parcels parcel-id {
                    owner: tx-sender,
                    coordinates: {x: x, y: y},
                    zone-type: zone,
                    structures: (list)
                })
                (var-set next-parcel-id (+ parcel-id u1))
                (ok parcel-id))
            err-owner-only)
    )
)

(define-public (transfer-land-parcel (parcel-id uint) (recipient principal))
    (let ((current-owner (unwrap! (nft-get-owner? land-parcel parcel-id) err-not-owner)))
        (if (is-eq tx-sender current-owner)
            (begin
                (try! (nft-transfer? land-parcel parcel-id current-owner recipient))
                (ok true))
            err-not-owner)
    )
)

;; Governance Functions
(define-public (submit-zoning-proposal (parcel-id uint) (new-zone (string-ascii 20)))
    (let
        ((proposal-id (var-get next-proposal-id))
         (stake-position (unwrap! (map-get? staking-positions tx-sender) err-insufficient-stake)))
        (if (>= (get amount stake-position) min-stake-amount)
            (begin
                (map-set proposals proposal-id {
                    proposer: tx-sender,
                    parcel-id: parcel-id,
                    proposed-zone: new-zone,
                    votes-for: u0,
                    votes-against: u0,
                    status: "active",
                    end-block: (+ block-height u144)
                })
                (var-set next-proposal-id (+ proposal-id u1))
                (ok proposal-id))
            err-insufficient-stake)
    )
)

(define-public (vote-on-proposal (proposal-id uint) (vote bool))
    (let 
        ((proposal (unwrap! (map-get? proposals proposal-id) err-invalid-proposal))
         (stake-position (unwrap! (map-get? staking-positions tx-sender) err-insufficient-stake)))
        (if (>= (get amount stake-position) min-stake-amount)
            (begin
                (if vote
                    (map-set proposals proposal-id 
                        (merge proposal {votes-for: (+ (get votes-for proposal) (get amount stake-position))}))
                    (map-set proposals proposal-id 
                        (merge proposal {votes-against: (+ (get votes-against proposal) (get amount stake-position))}))
                )
                (ok true))
            err-insufficient-stake)
    )
)

;; Read-only Functions
(define-read-only (get-land-parcel (parcel-id uint))
    (ok (map-get? land-parcels parcel-id))
)

(define-read-only (get-proposal (proposal-id uint))
    (ok (map-get? proposals proposal-id))
)

(define-read-only (get-staking-position (staker principal))
    (ok (map-get? staking-positions staker))
)
