
import Cesium from 'cesium/Source/Cesium'


export default class DrawProfile {
    constructor(viewer, style, callback) {
        this.viewer = viewer
        this.style = style

        this.handler = null
        this.tempEntities = []
        this.lineEntities = []
        this.linePositionList = []
        this.firstPoint = null;
        this.lastPoint = null;

        this.xys = []

        // 距离

        this.tempPoints = []

        this.callback = callback
        this._addDisListener()
        this.endDraw = false;
    }
    _addDisListener() {
        let viewer = this.viewer
        let scene = viewer.scene
        let linePositionList = this.linePositionList
        let firstPoint = this.firstPoint;
        let lastPoint = this.lastPoint;

        viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
        this.handler = new Cesium.ScreenSpaceEventHandler(scene.canvas)
        this._drawLine(linePositionList)

        let isDraw = false
        let reDraw = false
        let xys = this.xys;

        this.handler.setInputAction((movement) => {
            if (reDraw) {
                this._reDraw()
                reDraw = false
            }
            let pickedObject = scene.pick(movement.position)
            // if (!Cesium.defined(pickedObject) || pickedObject.primitive instanceof Cesium.Polyline || pickedObject.primitive instanceof Cesium.Primitive) {
            if (true) {
                // 方法二
                let ray = viewer.camera.getPickRay(movement.position);
                let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                const xy = movement.position;
                if (cartesian) {
                    // this.tempPoints.push(this._car3ToLatLon(cartesian))
                    if (isDraw) {
                        // 结束
                        if (firstPoint) {
                            lastPoint = cartesian.clone();

                            if (linePositionList.length === 1) {
                                linePositionList.push(lastPoint)

                                this.labelPosition = cartesian.clone()
                            } else if (linePositionList.length > 1) {
                                linePositionList.length = 0;
                                linePositionList.push(firstPoint)
                                linePositionList.push(lastPoint)

                            }
                            this._drawPoint(lastPoint)
                            xys.push({ x: xy.x, y: xy.y })
                            const data = this._getDistanceHeight(linePositionList, xys)
                            this.callback(data)
                            reDraw = true;
                            // 清除
                            xys = [];
                            isDraw = false
                            this.endDraw = true;

                        }


                    } else {
                        //开始
                        // if (this.endDraw) return;
                        firstPoint = cartesian.clone();
                        this.firstPoint = firstPoint;
                        this._drawPoint(firstPoint)
                        isDraw = true
                        linePositionList.push(firstPoint)
                        xys.push({ x: xy.x, y: xy.y })
                    }

                }

            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
        this.handler.setInputAction((movement) => {
            // 方法二
            let ray = viewer.camera.getPickRay(movement.endPosition);
            let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            if (cartesian) {
                if (isDraw) {
                    // 开始
                    if (firstPoint) {
                        lastPoint = cartesian.clone();
                        if (linePositionList.length === 1) {
                            linePositionList.push(lastPoint)
                            this.labelPosition = cartesian.clone()
                        } else if (linePositionList.length > 1) {
                            linePositionList.length = 0;
                            linePositionList.push(firstPoint)
                            linePositionList.push(lastPoint)
                        }

                    }

                }
            }

        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        this.handler.setInputAction((movement) => {

        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    }
    // 计算高程点,转成笛卡尔坐标
    _computePoint(firstPoint, lastPoint) {
        const first = this._car3ToLatLon(firstPoint);
        const last = this._car3ToLatLon(lastPoint);
        let h = {

        }
        if (first.height > last.height) {
            h = {
                lon: last.lon,
                lat: last.lat,
                height: first.height
            }
        } else {
            h = {
                lon: first.lon,
                lat: first.lat,
                height: last.height
            }
        }

        return Cesium.Cartesian3.fromDegrees(h.lon, h.lat, h.height)

    }
    _reDraw() {
        this.tempPoints = []
        this.linePositionList.length = 0
        for (let entity of this.tempEntities) {
            this.viewer.entities.remove(entity)
        }
        this.tempEntities = []
        this.firstPoint = null;
        this.lastPoint = null;
        this.xys = [];
    }
    _drawLine(linePositionList) {
        let lineStyle = this.style.lineStyle
        let entity = this.viewer.entities.add({
            polyline: lineStyle,
        })
        entity.polyline.positions = new Cesium.CallbackProperty(function () {
            return linePositionList
        }, false)

        this.lineEntities.push(entity)
    }

    _drawPoint(point_Cartesian3) {
        let entity =
            this.viewer.entities.add({
                position: point_Cartesian3,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.GOLD,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            })
        this.tempEntities.push(entity)
    }
   


    // 世界坐标转经纬坐标
    _car3ToLatLon(cartesian) {
        let cartographic = Cesium.Cartographic.fromCartesian(cartesian)
        let longitudeString = Cesium.Math.toDegrees(cartographic.longitude)
        let latitudeString = Cesium.Math.toDegrees(cartographic.latitude)
        return {
            lon: longitudeString,
            lat: latitudeString,
            height: cartographic.height
        }
    }
    //计算总距离-空间距离
    _getSpatialDistance(positions) {
        //空间两点距离计算函数

        var point1cartographic = Cesium.Cartographic.fromCartesian(positions[0]);
        var point2cartographic = Cesium.Cartographic.fromCartesian(positions[1]);
        /**根据经纬度计算出距离**/
        var geodesic = new Cesium.EllipsoidGeodesic();
        geodesic.setEndPoints(point1cartographic, point2cartographic);
        var s = geodesic.surfaceDistance;
        //console.log(Math.sqrt(Math.pow(distance, 2) + Math.pow(endheight, 2)));
        //返回两点之间的距离
        var d = Math.sqrt(Math.pow(s, 2) + Math.pow(point2cartographic.height - point1cartographic.height, 2));

        // return distance.toFixed(2);
        return {
            d_h: Math.abs(point2cartographic.height - point1cartographic.height),
            d_flat: s,
            d_spatial: d
        }

    }

    _getDistanceHeight(points, xys) {
       
        // 经纬度
        const startPoint = this._car3ToLatLon(points[0]);
        const endPoint = this._car3ToLatLon(points[1]);
        const pointSum = 10;  //取样点个数
        const addXTT = Cesium.Math.lerp(startPoint.lon, endPoint.lon, 1.0 / pointSum) - startPoint.lon;
        const addYTT = Cesium.Math.lerp(startPoint.lat, endPoint.lat, 1.0 / pointSum) - startPoint.lat;
        //  屏幕坐标
        const [leftXY, rightXY] = xys;
        var addX = Cesium.Math.lerp(leftXY.x, rightXY.x, 1.0 / pointSum) - leftXY.x;
        var addY = Cesium.Math.lerp(leftXY.y, rightXY.y, 1.0 / pointSum) - leftXY.y;
        var heightArr = [];
        for (let index = 0; index < pointSum; index++) {
            var x = leftXY.x + (index + 1) * addX;
            var y = leftXY.y + (index + 1) * addY;

            var eventPosition = { x: x, y: y };

            var ray = this.viewer.camera.getPickRay(eventPosition);
            var position = this.viewer.scene.globe.pick(ray, this.viewer.scene);
            if (Cesium.defined(position)) {
                // const position1=this.viewer.scene.clampToHeight(position) 
                var cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
                // console.log("点击处海拔高度为：" + cartographic.height + "米");
                heightArr[index] = cartographic.height.toFixed(2);   //保留两位小数
            }

        }
        return heightArr;

    }

    //移除整个资源
    remove() {
        var viewer = this.viewer

        for (let tempEntity of this.tempEntities) {
            viewer.entities.remove(tempEntity)
        }
        for (let lineEntity of this.lineEntities) {
            viewer.entities.remove(lineEntity)
        }
        if (this.handler) {
            this.handler.destroy()
        }
    }
}

