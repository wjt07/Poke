module battle {
	export class BattleStageControl extends egret.EventDispatcher {
		private static Delay_ReadyKick: number = 30000;       	//15秒不准备踢出
        public static Delay_SendCardAni: number = 6000;     	//4秒发牌动画
        private static Delay_CallLand: number = 10000;       	//10秒叫地主
        private static Delay_ShowCard: number = 25000;       	//25秒游戏发牌
		
		public _playerList = new Array<Player>(); 				//用户列表
		private _myOwner = new Player();						//我自己
		private _landLordUser = null;
		private _callLandLordUID:number = 0;					//叫地主的人的ID
		private _landLordCardList = [];							//底牌列表
		private _timesScore:string = "";

		private _stage:BattleStageUI = null;
    	
		private _playerHeader_left:PlayerHead = null;			//上家
		private _playerHeader_right:PlayerHead = null;			//下家

		private _playerTimer:PlayerTime = null;					//闹钟提示
		
		private _timeoutList:Array<number> = [];

		public constructor(stage:BattleStageUI) {
			super();
			this._stage = stage;
		}

		public init(){
			//添加监听消息
			this.BattleEventListen();
			this._playerHeader_left = new battle.PlayerHead();//上家
			this._playerHeader_right = new battle.PlayerHead();//下家
			this._playerTimer = new PlayerTime();
			this._playerTimer.Init();
			this._stage._playerTimerSprite.addChild(this._playerTimer);
			this._playerTimer.visible = false;
		}

		public startGame(){
			this.sendReadMsg();//发送准备消息
		}

		//设置底牌
		set landLordCardList(arr:Array<number>){
			this._landLordCardList = arr;
		}

		/**
		 * 添加用户
		 * @param {GUser} user
		 */
		public addPlayer(user:GUser){
			console.log("addPlayers",user);
			if(user){
				let player = new Player();
				player.avator = user.avator;
				player.nickName = user.nickName;
				player.userID = user.userID;
				player.pointValue = user.pointValue;
				player.rank = user.rank;
				this._playerList.push(player);
				if(player.userID == GlobalData.myUser.userID){
					this._myOwner = player;
				}
			}
		}

		//添加事件监听
		private BattleEventListen(){
			//network.BattleMsg.getInstance() 是事件发送者，准备游戏发送回调
			network.BattleMsg.getInstance().addEventListener(network.BattleMsgEvent.GAME_READY,this.GameReadyEventCall, this);

			//叫地主结束
			network.BattleMsg.getInstance().addEventListener(network.BattleMsgEvent.CALL_LANDLORD_OVER,this.CallLandLordOver, this);

			//下一个叫地主
			network.BattleMsg.getInstance().addEventListener(network.BattleMsgEvent.CALL_LANDLORD_NEXT,this.CallLandLordNext, this);
		}


		/**
		 * 设置牌列表
		 */
		private setCardList(list:Array<any>){
			let TableId  = 1;
			let myUser = this._myOwner;
			//获取牌列表
			this._playerList.forEach((element)=>{
				for(let i = 0; i < list.length; i++){
					if(list[i].userID == element.userID){
						console.info("setCardList",list[i].card);
						element.AddcardList(list[i].card);
						element.seatNo = i;
						element.IsReady = true;
					}
				}
				//分配上下家
				if(element.userID == myUser.userID){
					element.LocalTableId = 3;
				}else{
					element.LocalTableId = TableId++;
				}
				//显示用户头像
				this.SetPlayerHead(element,true);
			});
			//用户列表安装 seatNo排序
			this._playerList.sort(function(a,b){
				return a.seatNo < b.seatNo ? 1:-1;
			});
		}

		/**
		 * 准备游戏后, 收到发牌消息调用这个函数，给各个用户填写牌信息
		 */
		private GameReadyEventCall(event:egret.Event){
			this.removeEventListener(network.BattleMsgEvent.GAME_READY, this.GameReadyEventCall, this);
			console.info("GameReadyEventCall",event.data);
			let data = event.data;
			if(!data){
				return;
			}

			//获取地主牌
			if("lanownList" in data){
				this._landLordCardList = data.lanownList;
			}

			if("callOwner" in data){
				this._callLandLordUID = data.callOwner;
			}

			if("userCards" in data){
				//获取洗出的牌进设置到用户列表中
				this.setCardList(data.userCards);
			}

		
			this._timeoutList.push(egret.setTimeout(this.beginCallLandLord, this, 4000));
			this.SendCard();
		}

		/**
		 * 开始叫地主
		 */
		private beginCallLandLord(){
			console.info("beginCallLandLord:");
			let ismeCall = false;
			if(this._callLandLordUID == this._myOwner.userID){
				ismeCall = true;
			}

			this._playerList.forEach((value)=>{
				if(value.userID == this._callLandLordUID){
					console.info("beginCallLandLord",value);
					//显示叫地主
					this._stage.ShowCallLand(value, ismeCall,0,BattleStageControl.Delay_CallLand);
				}
			});			
		}

		/**
		 * 游戏结束的时候调用
		 */
		public GameOver(){
			//取消定时
			while (this._timeoutList.length > 0) {
            	egret.clearTimeout(this._timeoutList.pop());
        	}
		}

		/**
		 * CallLandOver 结束叫地主
		 */
		private CallLandLordOver(evt:egret.Event){
			console.log("叫地主结束", evt.data);
			if(!evt.data){
				return;
			}
			if("landOwner" in evt.data && "landCards" in evt.data && "value" in evt.data){
				let landOwnerID = evt.data.landOwner;
				//获取底牌
				this.landLordCardList = evt.data.landCards;
				for(let i = 0; i < this._playerList.length; i++){
					if(landOwnerID == this._playerList[i].userID){
						//获取地主
						this._landLordUser = this._playerList[i];
						//获取地主分数
						this._landLordUser.landlordScore = evt.data.value;
						this._timesScore = evt.data.value+"X"+1
					}
				}

				if(landOwnerID == this._myOwner.userID){
					//如果地主是我就给我添加地主牌
					this._myOwner.AddcardList(evt.data.landCards);
				}

				this._stage.OverCallLand(this._landLordUser, evt.data.landCards, this._myOwner,this._timesScore);
			}
		}

		/**
		 * 下一个叫地主的人
		 */
		private CallLandLordNext(event:egret.Event){
		}

		/**
		 * 启用发牌动画
		 */
		private SendCard(){
			// 发牌
			this._stage.SendCard(this._myOwner);
			this._playerHeader_left.ShowCard = true;
			this._playerHeader_left.Ready = false;
			this._playerHeader_right.ShowCard = true;
			this._playerHeader_right.Ready = false;
		}

		/**
		 * 发送准备消息
		 */
		private sendReadMsg(){
			network.BattleMsg.getInstance().sendToGameServer(network.NetMsgEvent.GAME_READY_S,{value:"ready"});
		}

		/**
		 * 显示对手玩家的头像
		 */
		public SetPlayerHead(p: Player, isin: boolean = false){
			if (p == null) {
                return;
            }
			//判断上下家 我
			if(p.userID == GlobalData.myUser.userID){
				return;
			}

			let localid = "left";
			if(p.LocalTableId == 2){
				localid = "right";
			}
			console.log("_playerHeader_",this["_playerHeader_" + localid]);
            (<PlayerHead>this["_playerHeader_" + localid]).Release();
            (<PlayerHead>this["_playerHeader_" + localid]).Init(p);
            this._stage._playerHeadSprite.addChildAt((<PlayerHead>this["_playerHeader_" + localid]), 0);
            (<PlayerHead>this["_playerHeader_" + localid]).Ready = p.IsReady;
            (<PlayerHead>this["_playerHeader_" + localid]).UpdateCardNum();
            (<PlayerHead>this["_playerHeader_" + localid]).LandFlagVisible(false, false);
            if (p.LocalTableId == 1) {
                this._playerHeader_left.x = 65;
                this._playerHeader_left.y = 190;
            }
            else if (p.LocalTableId == 2) {
                this._playerHeader_right.x = 475;
                this._playerHeader_right.y = 190;
            }

            if (isin && p.LocalTableId != 3) {
                var ph: PlayerHead = (<PlayerHead>this["_playerHeader_" + localid]);
                if (ph) {
                    egret.Tween.removeTweens(ph);
                    var tx: number = ph.x;
                    var fx: number = 0;
                    if (p.LocalTableId == 1) {
                        fx = tx - 300;
                    }
                    else if (p.LocalTableId == 2) {
                        fx = tx + 300;
                    }
                    ph.x = fx;
                    egret.Tween.get(ph).to({ x: tx }, 600);
                }
            }
		}

		public SetPlayerTime(p: Player, delaytime:number){
			this._playerTimer.SetPoint(p.LocalTableId, delaytime);
            this._playerTimer.visible = true;
		}

		/**
		 * 设置地主标志
		 */
		public SetPlayerLandFlag(landid: number){
			if(this["_playerHeader_left"]){
				this._playerHeader_left.IsLandOwner = false;
				this._playerHeader_left.LandFlagVisible(true, false);
			}

			if(this["_playerHeader_right"]){
				this._playerHeader_right.IsLandOwner = false;
				this._playerHeader_right.LandFlagVisible(true, false);
			}

			let left = "left";
			if(landid == 2){
				left ="right"
			}

			if(this["_playerHeader_"+left]){
				this["_playerHeader_"+left].IsLandOwner = false;
				this["_playerHeader_"+left].LandFlagVisible(true, true);
			}

		}

		/**
		 * 更新牌数
		 */
		public UpdateAllCardNum(){
			if(this["_playerHeader_left"]){
				this._playerHeader_left.ShowCard = true;
				this._playerHeader_left.UpdateCardNum();
			}

			if(this["_playerHeader_right"]){
				this._playerHeader_right.ShowCard = true;
				this._playerHeader_right.UpdateCardNum();
			}
		}

	}
}