class VideosController < ApplicationController
  def create
    head :no_content
    ActionCable.server.broadcast "videocalls:#{params[:room_id]}", video_params
  end

  private

  def video_params
    params.permit(:type, :from, :to, :sdp, :candidate, :room_id)
  end
end
