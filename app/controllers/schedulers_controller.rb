class SchedulersController < ApplicationController
  unloadable
  before_filter :current_project, :current_schedules, :current_user
  before_filter :login_required, :only => [:home]

  def home
    render :layout => false
  end

  def index
    # [TODO] RedmineのProjectオブジェクトにgroup_by_schedule_idを作る
    events = { }.tap do |license_and_events|
               current_schedules.each do |schedule|
                 license_and_events[schedule.id] = schedule.to_hash_with_events(current_date)
               end
            end

    respond_to do |format|
      format.json do
        render :json => events.to_json
      end
    end
  end

  def show
    render :layout => false
  end

  def create
    @schedule = Schedule.new(params[:schedule])
    if @schedule.save
      respond_to do |format|
        format.js { render :template => "schedulers/create.js.erb" }
      end
    end
  end

  def update
    schedule = current_schedules.find(params[:id])
    if schedule.update_attributes(title: params[:title], license: params[:license])
      respond_to do |format|
        format.js { render :json => schedule }
      end
    end
  end

  def destroy
    @schedule = current_project.schedules.find(params[:id])
    if @schedule.destroy
      respond_to do |format|
        format.js { render :template => "schedulers/destroy.js.erb" }
      end
    end
  end

  private
  def current_project
    begin
      @project = Project.find(params[:project_id])
    rescue ActiveRecord::RecordNotFound
      render_404
    end
  end

  def current_schedules
    @schedules = current_project.schedules
  end

  def current_date
    if params[:year] and params[:month]
      Date.new(params[:year].to_i, params[:month].to_i)
    else
      Date.new(Time.now.year, Time.now.month)
    end
  end

  def current_user
    User.current = User.find(session[:user_id]) if session[:user_id]
  end

  def login_required
    return true if User.current.logged?
    require_login
  end
end
